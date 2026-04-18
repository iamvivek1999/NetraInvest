# =============================================================================
#  setup-agent.ps1  — Windows PowerShell
#  Sets up the Python venv and installs all agent dependencies.
#
#  Usage (run from repo root):
#    Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
#    .\setup-agent.ps1
# =============================================================================

$ErrorActionPreference = "Stop"

$RepoRoot  = $PSScriptRoot
$AgentDir  = Join-Path $RepoRoot "agent"
$VenvDir   = Join-Path $AgentDir ".venv"
$ReqFile   = Join-Path $AgentDir "requirements.txt"

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║          Enigma AI Agent — Setup Script (PS)         ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ── 1. Check Python is available ─────────────────────────────────────────────
$PythonCmd = $null
foreach ($cmd in @("python", "python3", "py")) {
    if (Get-Command $cmd -ErrorAction SilentlyContinue) {
        $ver = & $cmd --version 2>&1
        if ($ver -match "Python 3\.(1[1-9]|[2-9]\d)") {
            $PythonCmd = $cmd
            break
        }
    }
}

if (-not $PythonCmd) {
    Write-Host "❌  Python 3.11+ not found. Download from https://www.python.org/downloads/" -ForegroundColor Red
    exit 1
}

$PyVersion = & $PythonCmd --version 2>&1
Write-Host "🐍  Using $PyVersion" -ForegroundColor Green

# ── 2. Create venv ───────────────────────────────────────────────────────────
if (Test-Path $VenvDir) {
    Write-Host "✅  .venv already exists — skipping creation." -ForegroundColor Green
} else {
    Write-Host "📦  Creating virtual environment at agent\.venv ..." -ForegroundColor Yellow
    & $PythonCmd -m venv $VenvDir
    Write-Host "✅  .venv created." -ForegroundColor Green
}

$VenvPip     = Join-Path $VenvDir "Scripts\pip.exe"
$VenvPython  = Join-Path $VenvDir "Scripts\python.exe"
$VenvUvicorn = Join-Path $VenvDir "Scripts\uvicorn.exe"

# ── 3. Upgrade pip ───────────────────────────────────────────────────────────
Write-Host ""
Write-Host "⬆️   Upgrading pip ..." -ForegroundColor Yellow
& $VenvPip install --upgrade pip --quiet

# ── 4. Install requirements ──────────────────────────────────────────────────
Write-Host ""
Write-Host "📥  Installing packages from requirements.txt ..." -ForegroundColor Yellow
& $VenvPip install -r $ReqFile

# ── 5. Link agent/ as enigma_ai package ──────────────────────────────────────
$SitePkg = & $VenvPython -c "import site; print(site.getsitepackages()[0])"
$LinkPath = Join-Path $SitePkg "enigma_ai"

if (-not (Test-Path $LinkPath)) {
    Write-Host ""
    Write-Host "🔗  Linking agent\ as enigma_ai package ..." -ForegroundColor Yellow
    # Use junction (works without admin rights on Windows)
    cmd /c "mklink /J `"$LinkPath`" `"$AgentDir`"" | Out-Null
    Write-Host "✅  Package linked." -ForegroundColor Green
} else {
    Write-Host "✅  enigma_ai package already linked." -ForegroundColor Green
}

# ── 6. Verify ────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "🔍  Verifying installation ..." -ForegroundColor Yellow
& $VenvPython -c @"
from enigma_ai.api.app import app
from enigma_ai.orchestrator import run_orchestrator
print('✅  All imports resolved. Agent is ready.')
"@

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  Setup complete!  To start the agent:                            ║" -ForegroundColor Cyan
Write-Host "║                                                                  ║" -ForegroundColor Cyan
Write-Host "║    .\start-agent.ps1                                            ║" -ForegroundColor Cyan
Write-Host "║  or manually:                                                    ║" -ForegroundColor Cyan
Write-Host "║    cd agent                                                      ║" -ForegroundColor Cyan
Write-Host "║    .\.venv\Scripts\uvicorn enigma_ai.api.app:app ``             ║" -ForegroundColor Cyan
Write-Host "║      --reload --host 0.0.0.0 --port 8000                        ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
