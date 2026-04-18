@echo off
:: =============================================================================
::  setup-agent.cmd  — Windows Command Prompt (CMD)
::  Sets up the Python venv and installs all agent dependencies.
::
::  Usage (run from repo root):
::    setup-agent.cmd
:: =============================================================================

setlocal enabledelayedexpansion

set "REPO_ROOT=%~dp0"
set "AGENT_DIR=%REPO_ROOT%agent"
set "VENV_DIR=%AGENT_DIR%\.venv"
set "REQ_FILE=%AGENT_DIR%\requirements.txt"

echo.
echo  =====================================================
echo   Enigma AI Agent -- Setup Script (CMD)
echo  =====================================================
echo.

:: ── 1. Find Python 3.11+ ──────────────────────────────────────────────────
set "PYTHON_CMD="
for %%P in (python python3 py) do (
    if not defined PYTHON_CMD (
        where %%P >nul 2>&1
        if !errorlevel! == 0 (
            for /f "tokens=2" %%V in ('%%P --version 2^>^&1') do (
                set "PY_VER=%%V"
            )
            set "PYTHON_CMD=%%P"
        )
    )
)

if not defined PYTHON_CMD (
    echo  ERROR: Python 3.11+ not found.
    echo  Download from https://www.python.org/downloads/
    exit /b 1
)

echo  [OK] Using Python !PY_VER! via !PYTHON_CMD!

:: ── 2. Create venv ────────────────────────────────────────────────────────
if exist "%VENV_DIR%" (
    echo  [OK] .venv already exists -- skipping creation.
) else (
    echo  [..] Creating virtual environment at agent\.venv ...
    !PYTHON_CMD! -m venv "%VENV_DIR%"
    if !errorlevel! neq 0 (
        echo  ERROR: Failed to create venv.
        exit /b 1
    )
    echo  [OK] .venv created.
)

set "VENV_PIP=%VENV_DIR%\Scripts\pip.exe"
set "VENV_PYTHON=%VENV_DIR%\Scripts\python.exe"

:: ── 3. Upgrade pip ────────────────────────────────────────────────────────
echo.
echo  [..] Upgrading pip ...
"%VENV_PIP%" install --upgrade pip --quiet
if !errorlevel! neq 0 (
    echo  WARNING: pip upgrade failed. Continuing anyway.
)

:: ── 4. Install requirements ───────────────────────────────────────────────
echo.
echo  [..] Installing packages from requirements.txt ...
"%VENV_PIP%" install -r "%REQ_FILE%"
if !errorlevel! neq 0 (
    echo  ERROR: Package installation failed.
    exit /b 1
)
echo  [OK] Packages installed.

:: ── 5. Link agent/ as enigma_ai package ──────────────────────────────────
for /f "delims=" %%S in ('"%VENV_PYTHON%" -c "import site; print(site.getsitepackages()[0])"') do (
    set "SITE_PKG=%%S"
)
set "LINK_PATH=!SITE_PKG!\enigma_ai"

if exist "!LINK_PATH!" (
    echo  [OK] enigma_ai package already linked.
) else (
    echo  [..] Linking agent\ as enigma_ai package ...
    mklink /J "!LINK_PATH!" "%AGENT_DIR%" >nul
    if !errorlevel! neq 0 (
        echo  WARNING: Could not create junction link. Try running as Administrator,
        echo  or manually copy/move agent\ to !LINK_PATH!
    ) else (
        echo  [OK] Package linked.
    )
)

:: ── 6. Verify ────────────────────────────────────────────────────────────
echo.
echo  [..] Verifying installation ...
"%VENV_PYTHON%" -c "from enigma_ai.api.app import app; from enigma_ai.orchestrator import run_orchestrator; print('[OK] All imports resolved. Agent is ready.')"
if !errorlevel! neq 0 (
    echo  ERROR: Import verification failed. Check the output above.
    exit /b 1
)

echo.
echo  =====================================================
echo   Setup complete!  Start the agent:
echo.
echo    start-agent.cmd
echo.
echo   or manually:
echo    cd agent
echo    .venv\Scripts\uvicorn enigma_ai.api.app:app ^
echo      --reload --host 0.0.0.0 --port 8000
echo  =====================================================
echo.

endlocal
