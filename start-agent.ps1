# =============================================================================
#  start-agent.ps1  — Windows PowerShell
#  Starts the Enigma AI FastAPI server using the local agent\.venv
#
#  Usage (run from repo root):
#    .\start-agent.ps1
# =============================================================================

$RepoRoot    = $PSScriptRoot
$AgentDir    = Join-Path $RepoRoot "agent"
$VenvDir     = Join-Path $AgentDir ".venv"
$VenvUvicorn = Join-Path $VenvDir "Scripts\uvicorn.exe"

if (-not (Test-Path $VenvUvicorn)) {
    Write-Host ""
    Write-Host "❌  .venv not found or uvicorn missing." -ForegroundColor Red
    Write-Host "    Run setup first:  .\setup-agent.ps1" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

Write-Host ""
Write-Host "🤖  Enigma AI Agent starting..." -ForegroundColor Cyan
Write-Host "    URL    → http://localhost:8000" -ForegroundColor Green
Write-Host "    Docs   → http://localhost:8000/docs" -ForegroundColor Green
Write-Host "    Health → http://localhost:8000/health" -ForegroundColor Green
Write-Host ""
Write-Host "    Press Ctrl+C to stop." -ForegroundColor Gray
Write-Host ""

Set-Location $AgentDir

& $VenvUvicorn enigma_ai.api.app:app `
    --reload `
    --host 0.0.0.0 `
    --port 8000 `
    --log-level info
