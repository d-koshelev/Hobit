param(
    [Alias("Profile")]
    [string]$ValidationProfile = "full",
    [switch]$Help
)

$ErrorActionPreference = "Stop"

$AllowedProfiles = @("fast", "changed", "full")
$script:StepTimings = New-Object System.Collections.Generic.List[object]
$script:TotalTimer = [System.Diagnostics.Stopwatch]::StartNew()

function Show-Help {
    Write-Host "Usage: scripts/hobit/validate.ps1 [-Profile fast|changed|full]"
    Write-Host ""
    Write-Host "Runs a Hobit validation profile from the repository root."
    Write-Host ""
    Write-Host "Profiles:"
    Write-Host "  fast     Quick iteration: frontend typecheck, cargo check, changed file sizes, git diff --check."
    Write-Host "  changed  Git-changed-file based checks plus changed file sizes and git diff --check."
    Write-Host "  full     Full validation sequence. This is the default when no profile is passed."
    Write-Host ""
    Write-Host "Exit codes: 0 ok, 1 validation/check failed, 2 usage/environment error."
}

function Write-ToolError {
    param([string]$Message)
    [Console]::Error.WriteLine("ERROR: $Message")
}

function Exit-UsageError {
    param([string]$Message)
    Write-ToolError $Message
    Show-Help
    exit 2
}

$remainingArgs = @($args)
if ($Help -or $remainingArgs -contains "--help" -or $remainingArgs -contains "-h") {
    Show-Help
    exit 0
}

for ($index = 0; $index -lt $remainingArgs.Count; $index += 1) {
    $argument = [string]$remainingArgs[$index]
    if ($argument -eq "--profile") {
        if ($index + 1 -ge $remainingArgs.Count) {
            Exit-UsageError "Missing value for --profile."
        }
        $ValidationProfile = [string]$remainingArgs[$index + 1]
        $index += 1
    } elseif ($argument.StartsWith("--profile=", [System.StringComparison]::OrdinalIgnoreCase)) {
        $ValidationProfile = $argument.Substring("--profile=".Length)
    } else {
        Exit-UsageError "Unexpected arguments: $remainingArgs"
    }
}

$SelectedProfile = $ValidationProfile.ToLowerInvariant()
if ($AllowedProfiles -notcontains $SelectedProfile) {
    Exit-UsageError "Unknown validation profile '$ValidationProfile'. Expected one of: $($AllowedProfiles -join ', ')."
}

if (!(Test-Path -LiteralPath "AGENTS.md") -or !(Test-Path -LiteralPath "Cargo.toml")) {
    Write-ToolError "Run this script from the Hobit repository root."
    exit 2
}

function Test-PythonCandidate {
    param([string]$Candidate)

    if ([string]::IsNullOrWhiteSpace($Candidate)) {
        return $false
    }

    try {
        & $Candidate --version *> $null
        return $LASTEXITCODE -eq 0
    } catch {
        return $false
    }
}

function Resolve-Python {
    $candidates = @()
    if (![string]::IsNullOrWhiteSpace($env:HOBIT_PYTHON)) {
        $candidates += $env:HOBIT_PYTHON
    }
    $candidates += @("python", "python3")

    $localPrograms = Join-Path $env:LOCALAPPDATA "Programs"
    if (Test-Path -LiteralPath $localPrograms) {
        Get-ChildItem -LiteralPath $localPrograms -Directory -ErrorAction SilentlyContinue | ForEach-Object {
            $candidates += Join-Path $_.FullName "python.exe"
            $candidates += Join-Path $_.FullName "bin\python.exe"
        }
    }

    foreach ($candidate in $candidates) {
        if (Test-PythonCandidate $candidate) {
            return $candidate
        }
    }

    Write-ToolError "Python was not found. Install Python or set HOBIT_PYTHON to a Python executable."
    exit 2
}

$PythonCommand = Resolve-Python

function Format-Duration {
    param([double]$Seconds)
    return ("{0:N1}s" -f $Seconds)
}

function Add-StepTiming {
    param(
        [string]$Name,
        [double]$Seconds
    )

    $script:StepTimings.Add(
        [pscustomobject]@{
            Name = $Name
            Seconds = $Seconds
        }
    ) | Out-Null
}

function Write-TimingSummary {
    Write-Host ""
    Write-Host "Step timings:"
    if ($script:StepTimings.Count -eq 0) {
        Write-Host "- none"
    } else {
        foreach ($timing in $script:StepTimings) {
            Write-Host ("- {0}: {1}" -f $timing.Name, (Format-Duration $timing.Seconds))
        }
    }
    Write-Host ("Total: {0}" -f (Format-Duration $script:TotalTimer.Elapsed.TotalSeconds))
}

function Invoke-Step {
    param(
        [string]$Name,
        [scriptblock]$Command
    )

    Write-Host ""
    Write-Host "==> $Name"
    $stepTimer = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        & $Command
        $exitCode = $LASTEXITCODE
    } catch {
        $stepTimer.Stop()
        Add-StepTiming $Name $stepTimer.Elapsed.TotalSeconds
        Write-ToolError "Step failed: $Name"
        Write-ToolError $_.Exception.Message
        Write-TimingSummary
        if ($_.Exception -is [System.Management.Automation.CommandNotFoundException]) {
            exit 2
        }
        exit 1
    }

    $stepTimer.Stop()
    Add-StepTiming $Name $stepTimer.Elapsed.TotalSeconds
    if ($null -ne $exitCode -and $exitCode -ne 0) {
        Write-ToolError "Step failed: $Name"
        Write-TimingSummary
        if ($exitCode -eq 126 -or $exitCode -eq 127) {
            exit 2
        }
        exit 1
    }
}

function Normalize-RepoPath {
    param([string]$Path)
    return ($Path -replace "\\", "/").Trim('"')
}

function Test-IgnoredPath {
    param([string]$Path)

    if ($Path.EndsWith(".zip", [System.StringComparison]::OrdinalIgnoreCase)) {
        return $true
    }

    $ignoredParts = @(".git", ".vite", "target", "node_modules", "dist", "gen")
    foreach ($part in ($Path -split "/")) {
        if ($ignoredParts -contains $part) {
            return $true
        }
    }

    return $false
}

function Invoke-GitLines {
    param(
        [string[]]$GitArguments,
        [string]$FailureMessage
    )

    $output = & git @GitArguments
    if ($LASTEXITCODE -ne 0) {
        Write-ToolError $FailureMessage
        exit 2
    }

    return @($output | Where-Object { ![string]::IsNullOrWhiteSpace($_) })
}

function Get-ChangedFiles {
    $diffFiles = Invoke-GitLines -GitArguments @("diff", "--name-only", "HEAD", "--") -FailureMessage "Failed to inspect changed files with git diff."
    $untrackedFiles = Invoke-GitLines -GitArguments @("ls-files", "--others", "--exclude-standard") -FailureMessage "Failed to inspect untracked files with git ls-files."

    $paths = @()
    foreach ($path in @($diffFiles + $untrackedFiles)) {
        $normalized = Normalize-RepoPath $path
        if (![string]::IsNullOrWhiteSpace($normalized) -and !(Test-IgnoredPath $normalized)) {
            $paths += $normalized
        }
    }

    return @($paths | Sort-Object -Unique)
}

function Test-DocumentationPath {
    param([string]$Path)
    return (
        $Path.EndsWith(".md", [System.StringComparison]::OrdinalIgnoreCase) -or
        $Path.StartsWith("docs/", [System.StringComparison]::OrdinalIgnoreCase) -or
        $Path.StartsWith("decisions/", [System.StringComparison]::OrdinalIgnoreCase)
    )
}

function Test-RustRelevantPath {
    param([string]$Path)

    $fileName = [System.IO.Path]::GetFileName($Path)
    if ($Path -eq "Cargo.toml" -or $Path -eq "Cargo.lock") {
        return $true
    }
    if ($fileName -eq "Cargo.toml" -and (
        $Path.StartsWith("crates/", [System.StringComparison]::OrdinalIgnoreCase) -or
        $Path.StartsWith("apps/desktop/src-tauri/", [System.StringComparison]::OrdinalIgnoreCase)
    )) {
        return $true
    }
    if (($fileName -eq "build.rs" -or $Path.EndsWith(".rs", [System.StringComparison]::OrdinalIgnoreCase)) -and (
        $Path.StartsWith("crates/", [System.StringComparison]::OrdinalIgnoreCase) -or
        $Path.StartsWith("apps/desktop/src-tauri/", [System.StringComparison]::OrdinalIgnoreCase)
    )) {
        return $true
    }

    return $false
}

function Test-CargoGraphPath {
    param([string]$Path)

    $fileName = [System.IO.Path]::GetFileName($Path)
    return $Path -eq "Cargo.toml" -or $Path -eq "Cargo.lock" -or $fileName -eq "Cargo.toml"
}

function Get-RustPackageForPath {
    param([string]$Path)

    if ($Path.StartsWith("crates/hobit-app/", [System.StringComparison]::OrdinalIgnoreCase)) {
        return "hobit-app"
    }
    if ($Path.StartsWith("crates/hobit-storage-sqlite/", [System.StringComparison]::OrdinalIgnoreCase)) {
        return "hobit-storage-sqlite"
    }
    if ($Path.StartsWith("crates/hobit-tools/", [System.StringComparison]::OrdinalIgnoreCase)) {
        return "hobit-tools"
    }
    if ($Path.StartsWith("crates/hobit-core/", [System.StringComparison]::OrdinalIgnoreCase)) {
        return "hobit-core"
    }
    if ($Path.StartsWith("crates/hobit-agent/", [System.StringComparison]::OrdinalIgnoreCase)) {
        return "hobit-agent"
    }
    if ($Path.StartsWith("apps/desktop/src-tauri/", [System.StringComparison]::OrdinalIgnoreCase)) {
        return "hobit-desktop"
    }

    return $null
}

function Invoke-FastProfile {
    Invoke-Step "npm typecheck" { npm.cmd run typecheck --prefix apps/desktop/frontend }
    Invoke-Step "cargo check" { cargo check --workspace }
    Invoke-Step "check-file-sizes changed-only" { & $PythonCommand scripts/hobit/check-file-sizes.py --changed-only }
    Invoke-Step "git diff --check" { git diff --check }
}

function Invoke-ChangedProfile {
    $changedFiles = Get-ChangedFiles
    Write-Host "Changed profile considered $($changedFiles.Count) changed file(s) after Toolbelt ignores."

    $frontendChanged = $false
    $frontendSourceOrConfigChanged = $false
    $rustChanged = $false
    $cargoGraphChanged = $false
    $rustPackages = @()

    foreach ($path in $changedFiles) {
        if ($path.StartsWith("apps/desktop/frontend/", [System.StringComparison]::OrdinalIgnoreCase)) {
            $frontendChanged = $true
            if (!(Test-DocumentationPath $path)) {
                $frontendSourceOrConfigChanged = $true
            }
        }

        if (Test-RustRelevantPath $path) {
            $rustChanged = $true
            if (Test-CargoGraphPath $path) {
                $cargoGraphChanged = $true
            }

            $package = Get-RustPackageForPath $path
            if (![string]::IsNullOrWhiteSpace($package)) {
                $rustPackages += $package
            }
        }
    }

    $rustPackages = @($rustPackages | Sort-Object -Unique)

    if ($frontendChanged) {
        Invoke-Step "npm typecheck" { npm.cmd run typecheck --prefix apps/desktop/frontend }
    }
    if ($frontendSourceOrConfigChanged) {
        Invoke-Step "npm build" { npm.cmd run build --prefix apps/desktop/frontend }
    }

    if ($rustChanged) {
        Invoke-Step "cargo check" { cargo check --workspace }
        if ($cargoGraphChanged -or $rustPackages.Count -ne 1) {
            Invoke-Step "cargo test workspace" { cargo test --workspace }
        } else {
            $package = $rustPackages[0]
            Invoke-Step "cargo test -p $package" { cargo test -p $package }
        }
    }

    Invoke-Step "check-file-sizes changed-only" { & $PythonCommand scripts/hobit/check-file-sizes.py --changed-only }
    Invoke-Step "git diff --check" { git diff --check }
}

function Invoke-FullProfile {
    Invoke-Step "npm typecheck" { npm.cmd run typecheck --prefix apps/desktop/frontend }
    Invoke-Step "npm build" { npm.cmd run build --prefix apps/desktop/frontend }
    Invoke-Step "cargo fmt" { cargo fmt --all }
    Invoke-Step "cargo check" { cargo check --workspace }
    Invoke-Step "cargo test workspace" { cargo test --workspace }
    Invoke-Step "check-file-sizes" { & $PythonCommand scripts/hobit/check-file-sizes.py }
    Invoke-Step "git diff --check" { git diff --check }
    Invoke-Step "git status" { git status --short --branch }
}

Write-Host "Hobit validation profile: $SelectedProfile"

switch ($SelectedProfile) {
    "fast" { Invoke-FastProfile }
    "changed" { Invoke-ChangedProfile }
    "full" { Invoke-FullProfile }
}

Write-TimingSummary
exit 0
