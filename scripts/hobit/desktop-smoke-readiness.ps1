param(
    [string]$DatabasePath = "",
    [switch]$Reset,
    [switch]$Launch,
    [switch]$Help
)

$ErrorActionPreference = "Stop"

function Show-Help {
    Write-Host "Usage: scripts/hobit/desktop-smoke-readiness.ps1 [-DatabasePath <path>] [-Reset] [-Launch]"
    Write-Host ""
    Write-Host "Prepares an isolated HOBIT_DATABASE_PATH workflow for manual Tauri desktop smoke runs."
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -DatabasePath <path>  SQLite file path to use. Defaults to target/hobit-smoke/desktop/hobit-desktop-smoke.sqlite3."
    Write-Host "  -Reset                Delete the selected smoke database files before printing commands."
    Write-Host "                        Refuses to reset paths outside target/hobit-smoke."
    Write-Host "  -Launch               Run npm.cmd run tauri:dev with HOBIT_DATABASE_PATH set."
    Write-Host "  -Help                 Show this help."
    Write-Host ""
    Write-Host "Exit codes: 0 ok, 1 command failed, 2 usage/environment error."
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

function Quote-PowerShellValue {
    param([string]$Value)
    return "'" + ($Value -replace "'", "''") + "'"
}

function Test-IsChildPath {
    param(
        [string]$Path,
        [string]$Parent
    )

    $fullPath = [System.IO.Path]::GetFullPath($Path)
    $fullParent = [System.IO.Path]::GetFullPath($Parent)
    $separator = [System.IO.Path]::DirectorySeparatorChar
    if (!$fullParent.EndsWith($separator)) {
        $fullParent = "$fullParent$separator"
    }

    return $fullPath.StartsWith($fullParent, [System.StringComparison]::OrdinalIgnoreCase)
}

if ($Help -or $args -contains "--help" -or $args -contains "-h") {
    Show-Help
    exit 0
}

if (!(Test-Path -LiteralPath "AGENTS.md") -or !(Test-Path -LiteralPath "Cargo.toml")) {
    Write-ToolError "Run this script from the Hobit repository root."
    exit 2
}

$repoRoot = [System.IO.Path]::GetFullPath((Get-Location).Path)
$defaultSmokeRoot = [System.IO.Path]::GetFullPath((Join-Path $repoRoot "target\hobit-smoke"))
$defaultDatabasePath = Join-Path $defaultSmokeRoot "desktop\hobit-desktop-smoke.sqlite3"

if ([string]::IsNullOrWhiteSpace($DatabasePath)) {
    $DatabasePath = $defaultDatabasePath
}

$resolvedDatabasePath = [System.IO.Path]::GetFullPath($DatabasePath)
$databaseParent = Split-Path -Parent $resolvedDatabasePath

if ([string]::IsNullOrWhiteSpace($databaseParent)) {
    Exit-UsageError "Database path must include a parent directory."
}

if (Test-Path -LiteralPath $resolvedDatabasePath -PathType Container) {
    Exit-UsageError "Database path points at a directory. Choose a writable SQLite file path."
}

New-Item -ItemType Directory -Path $databaseParent -Force | Out-Null

$probePath = Join-Path $databaseParent ".hobit-smoke-write-probe"
try {
    Set-Content -LiteralPath $probePath -Value "probe" -Encoding UTF8 -NoNewline
} catch {
    Write-ToolError "Database parent directory is not writable: $databaseParent"
    Write-ToolError $_.Exception.Message
    exit 2
} finally {
    if (Test-Path -LiteralPath $probePath) {
        Remove-Item -LiteralPath $probePath -Force
    }
}

if ($Reset) {
    $resetTargets = @(
        $resolvedDatabasePath,
        "$resolvedDatabasePath-shm",
        "$resolvedDatabasePath-wal"
    )

    foreach ($target in $resetTargets) {
        $resolvedTarget = [System.IO.Path]::GetFullPath($target)
        if (!(Test-IsChildPath $resolvedTarget $defaultSmokeRoot)) {
            Exit-UsageError "Refusing -Reset outside target/hobit-smoke: $resolvedTarget"
        }
        if (Test-Path -LiteralPath $resolvedTarget) {
            Remove-Item -LiteralPath $resolvedTarget -Force
        }
    }
}

Write-Host "Hobit desktop smoke readiness"
Write-Host ""
Write-Host "Database path readiness:"
Write-Host "  HOBIT_DATABASE_PATH: $resolvedDatabasePath"
Write-Host "  Parent writable: yes"
if ($Reset) {
    Write-Host "  Reset: completed for database, -shm, and -wal files under target/hobit-smoke"
} else {
    Write-Host "  Reset: not requested"
}
Write-Host ""
Write-Host "App launch readiness:"
Write-Host "  Set HOBIT_DATABASE_PATH before launching Tauri:"
Write-Host ("    `$env:HOBIT_DATABASE_PATH = {0}" -f (Quote-PowerShellValue $resolvedDatabasePath))
Write-Host "    npm.cmd run tauri:dev --prefix apps/desktop/frontend"
Write-Host ""
Write-Host "Mocked Queue-to-Executor smoke:"
Write-Host "    node scripts/hobit/smoke-queue-executor-ui.mjs"
Write-Host ""
Write-Host "Manual desktop UI verification still requires operator/WebView interaction:"
Write-Host "  1. Create or open a Workspace."
Write-Host "  2. Add Agent Queue and Agent Executor widgets."
Write-Host "  3. Create a Queue task with a non-empty prompt."
Write-Host "  4. Assign the task to the visible Agent Executor slot."
Write-Host "  5. Provide an explicit repository root and run the assigned task."
Write-Host "  6. Verify Agent Executor shows execution visibility and Agent Queue final-status refresh."
Write-Host ""
Write-Host "This helper does not automate WebView interaction and does not verify a full real desktop smoke pass."

if ($Launch) {
    $npm = Get-Command "npm.cmd" -ErrorAction SilentlyContinue
    if ($null -eq $npm) {
        Write-ToolError "npm.cmd was not found on PATH."
        exit 2
    }

    Write-Host ""
    Write-Host "Launching Tauri dev with isolated HOBIT_DATABASE_PATH..."
    $env:HOBIT_DATABASE_PATH = $resolvedDatabasePath
    & npm.cmd run tauri:dev --prefix apps/desktop/frontend
    exit $LASTEXITCODE
}
