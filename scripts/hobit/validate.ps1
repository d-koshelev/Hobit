param(
    [switch]$Help
)

$ErrorActionPreference = "Stop"

function Show-Help {
    Write-Host "Usage: scripts/hobit/validate.ps1"
    Write-Host ""
    Write-Host "Runs the standard Hobit validation sequence from the repository root."
    Write-Host "Exit codes: 0 ok, 1 validation failed, 2 usage/environment error."
}

function Write-ToolError {
    param([string]$Message)
    [Console]::Error.WriteLine("ERROR: $Message")
}

if ($Help -or $args -contains "--help" -or $args -contains "-h") {
    Show-Help
    exit 0
}

if ($args.Count -gt 0) {
    Write-ToolError "Unexpected arguments: $args"
    Show-Help
    exit 2
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

function Invoke-Step {
    param(
        [string]$Name,
        [scriptblock]$Command
    )

    Write-Host ""
    Write-Host "==> $Name"
    & $Command
    if ($LASTEXITCODE -ne 0) {
        Write-ToolError "Step failed: $Name"
        exit 1
    }
}

Invoke-Step "Frontend typecheck" { npm.cmd run typecheck --prefix apps/desktop/frontend }
Invoke-Step "Frontend production build" { npm.cmd run build --prefix apps/desktop/frontend }
Invoke-Step "Rust formatting" { cargo fmt --all }
Invoke-Step "Rust workspace check" { cargo check --workspace }
Invoke-Step "Rust workspace tests" { cargo test --workspace }
Invoke-Step "Hobit file size check" { & $PythonCommand scripts/hobit/check-file-sizes.py }
Invoke-Step "Git whitespace check" { git diff --check }
Invoke-Step "Git status" { git status --short --branch }
