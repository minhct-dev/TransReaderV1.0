<#
.SYNOPSIS
  Runs only the API layer (tests\e2e\api) of the TransReader E2E suite.

.DESCRIPTION
  The API tests call Rust commands through the real debug app, with the third-party
  APIs replaced by a local stub. They never touch your real library: the app under
  test uses its own identifier (com.minhct.transreader.e2e).

  The Python venv and msedgedriver live in %LOCALAPPDATA%\transreader-e2e, NOT in the
  repo: files created inside the workspace get a Low integrity label from the DSH
  sandbox, and a Low-integrity python cannot write to TEMP or %APPDATA%.

.EXAMPLE
  .\run-api-tests.ps1                      # run all API tests
  .\run-api-tests.ps1 -Setup               # first time: venv, tauri-driver, msedgedriver
  .\run-api-tests.ps1 -Build               # rebuild the debug app first
  .\run-api-tests.ps1 -Marker smoke        # only tests marked smoke
  .\run-api-tests.ps1 -K dictionary        # only tests whose name matches "dictionary"
  .\run-api-tests.ps1 -- -x --tb=short     # everything after -- goes to pytest
#>
[CmdletBinding()]
param(
    [switch]$Setup,
    [switch]$Build,
    [string]$Marker,
    [string]$K,
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$PytestArgs
)

$ErrorActionPreference = 'Stop'

$Here     = $PSScriptRoot
$Root     = (Resolve-Path (Join-Path $Here '..\..')).Path
$E2eHome  = Join-Path $env:LOCALAPPDATA 'transreader-e2e'
$VenvPy   = Join-Path $E2eHome 'venv\Scripts\python.exe'
$Drivers  = Join-Path $E2eHome 'drivers'
$AppExe   = Join-Path $Root 'src-tauri\target\debug\minhct-transreader.exe'
$CargoBin = Join-Path $env:USERPROFILE '.cargo\bin'
$RealDb   = Join-Path $env:APPDATA 'com.minhct.transreader\reader.db'

function Step($text) { Write-Host "`n==> $text" -ForegroundColor Cyan }
function Fail($text) { Write-Host "ERROR: $text" -ForegroundColor Red; exit 2 }

# ---- 1. One-time setup -----------------------------------------------------
$needSetup = $Setup -or -not (Test-Path $VenvPy) -or
             -not (Test-Path (Join-Path $Drivers 'msedgedriver.exe')) -or
             -not (Test-Path (Join-Path $CargoBin 'tauri-driver.exe'))
if ($needSetup) {
    Step 'Setting up the test environment'
    New-Item -ItemType Directory -Force $E2eHome, $Drivers | Out-Null

    if (-not (Test-Path $VenvPy)) {
        if (-not (Get-Command uv -ErrorAction SilentlyContinue)) { Fail 'uv is not installed (needed to create the venv).' }
        uv venv (Join-Path $E2eHome 'venv') --python 3.12
        if ($LASTEXITCODE -ne 0) { Fail 'uv venv failed.' }
    }
    uv pip install --python $VenvPy -r (Join-Path $Here 'requirements.txt')
    if ($LASTEXITCODE -ne 0) { Fail 'installing Python packages failed.' }

    if (-not (Test-Path (Join-Path $CargoBin 'tauri-driver.exe'))) {
        cargo install tauri-driver --locked
        if ($LASTEXITCODE -ne 0) { Fail 'cargo install tauri-driver failed.' }
    }
    if (-not (Test-Path (Join-Path $CargoBin 'msedgedriver-tool.exe'))) {
        cargo install --git https://github.com/chippers/msedgedriver-tool
        if ($LASTEXITCODE -ne 0) { Fail 'cargo install msedgedriver-tool failed.' }
    }
    # Downloads the msedgedriver that matches the installed WebView2 into the current folder.
    Push-Location $Drivers
    try { & (Join-Path $CargoBin 'msedgedriver-tool.exe') } finally { Pop-Location }
    if (-not (Test-Path (Join-Path $Drivers 'msedgedriver.exe'))) { Fail 'msedgedriver was not downloaded.' }
}

# ---- 2. Build the app under test --------------------------------------------
if ($Build -or -not (Test-Path $AppExe)) {
    Step 'Building the debug app with the e2e identifier'
    Push-Location $Root
    try {
        npx tauri build --debug --no-bundle --config src-tauri/tauri.e2e.conf.json
        if ($LASTEXITCODE -ne 0) { Fail 'tauri build failed.' }
    } finally { Pop-Location }
} else {
    $newest = Get-ChildItem (Join-Path $Root 'src-tauri\src'), (Join-Path $Root 'src') -Recurse -File |
              Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($newest.LastWriteTime -gt (Get-Item $AppExe).LastWriteTime) {
        Write-Host "WARNING: $($newest.FullName) is newer than the built app. Re-run with -Build to test the latest code." -ForegroundColor Yellow
    }
}

# ---- 3. Run pytest on tests\e2e\api only -------------------------------------
$env:PATH = "$Drivers;$CargoBin;$env:PATH"
$realBefore = if (Test-Path $RealDb) { (Get-Item $RealDb).LastWriteTime } else { $null }

$pytest = @('-m', 'pytest', 'api', '-p', 'no:cacheprovider', '--no-header', '-rfEX')
if ($Marker) { $pytest += @('-m', $Marker) }
if ($K)      { $pytest += @('-k', $K) }
if ($PytestArgs) { $pytest += ($PytestArgs | Where-Object { $_ -ne '--' }) }

Step ("pytest " + (($pytest | Select-Object -Skip 2) -join ' '))
$exit = 1
Push-Location $Here
try {
    & $VenvPy @pytest
    $exit = $LASTEXITCODE
} finally {
    Pop-Location

    # ---- 4. Clean up only what this run started ------------------------------
    # Never kill by app name alone: `tauri dev` runs the same exe name.
    $drivers = Get-Process tauri-driver, msedgedriver -ErrorAction SilentlyContinue
    if ($drivers) {
        $ids = @($drivers.Id)
        $children = Get-CimInstance Win32_Process -Filter "Name = 'minhct-transreader.exe'" |
                    Where-Object { $ids -contains $_.ParentProcessId }
        $children | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
        $drivers  | Stop-Process -Force -ErrorAction SilentlyContinue
    }
}

# ---- 5. Safety check + summary ----------------------------------------------
if ($null -ne $realBefore) {
    $touched = (Get-Item $RealDb).LastWriteTime -ne $realBefore
    if ($touched) { Write-Host 'WARNING: your real reader.db changed during the run. Check that you did not use the app at the same time.' -ForegroundColor Yellow }
    else          { Write-Host 'Your real library (reader.db) was not touched.' -ForegroundColor DarkGray }
}
$junit = Join-Path $Here 'reports\junit.xml'
if (Test-Path $junit) { Write-Host "JUnit report: $junit" -ForegroundColor DarkGray }

exit $exit
