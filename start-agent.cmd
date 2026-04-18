@echo off
:: =============================================================================
::  start-agent.cmd  — Windows Command Prompt (CMD)
::  Starts the Enigma AI FastAPI server using the local agent\.venv
::
::  Usage (run from repo root):
::    start-agent.cmd
:: =============================================================================

setlocal

set "REPO_ROOT=%~dp0"
set "AGENT_DIR=%REPO_ROOT%agent"
set "VENV_UVICORN=%AGENT_DIR%\.venv\Scripts\uvicorn.exe"

if not exist "%VENV_UVICORN%" (
    echo.
    echo  ERROR: .venv not found or uvicorn missing.
    echo  Run setup first:  setup-agent.cmd
    echo.
    exit /b 1
)

echo.
echo  Enigma AI Agent starting...
echo    URL    ^=^> http://localhost:8000
echo    Docs   ^=^> http://localhost:8000/docs
echo    Health ^=^> http://localhost:8000/health
echo.
echo  Press Ctrl+C to stop.
echo.

cd /d "%AGENT_DIR%"

"%VENV_UVICORN%" enigma_ai.api.app:app ^
    --reload ^
    --host 0.0.0.0 ^
    --port 8000 ^
    --log-level info

endlocal
