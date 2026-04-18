#!/usr/bin/env bash
# =============================================================================
#  setup-agent.sh  — Linux / macOS
#  Sets up the Python venv and installs all agent dependencies.
#
#  Usage:
#    chmod +x setup-agent.sh
#    ./setup-agent.sh
# =============================================================================

set -e  # Exit immediately on any error

AGENT_DIR="$(cd "$(dirname "$0")/agent" && pwd)"
VENV_DIR="$AGENT_DIR/.venv"
PYTHON="python3"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║          Enigma AI Agent — Setup Script              ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ── 1. Check Python 3 is available ──────────────────────────────────────────
if ! command -v "$PYTHON" &>/dev/null; then
  echo "❌  python3 not found. Please install Python 3.11+ and try again."
  exit 1
fi
PYTHON_VER=$($PYTHON --version 2>&1)
echo "🐍  Using $PYTHON_VER"

# ── 2. Create venv if it doesn't already exist ───────────────────────────────
if [ -d "$VENV_DIR" ]; then
  echo "✅  .venv already exists — skipping creation."
else
  echo "📦  Creating virtual environment at agent/.venv ..."
  $PYTHON -m venv "$VENV_DIR"
  echo "✅  .venv created."
fi

# ── 3. Upgrade pip ───────────────────────────────────────────────────────────
echo ""
echo "⬆️   Upgrading pip ..."
"$VENV_DIR/bin/pip" install --upgrade pip --quiet

# ── 4. Install requirements ──────────────────────────────────────────────────
echo ""
echo "📥  Installing packages from requirements.txt ..."
"$VENV_DIR/bin/pip" install -r "$AGENT_DIR/requirements.txt"

# ── 5. Install agent/ as enigma_ai package (symlink) ─────────────────────────
SITE_PKG=$("$VENV_DIR/bin/python" -c "import site; print(site.getsitepackages()[0])")
if [ ! -e "$SITE_PKG/enigma_ai" ]; then
  echo ""
  echo "🔗  Linking agent/ as enigma_ai package ..."
  ln -sf "$AGENT_DIR" "$SITE_PKG/enigma_ai"
fi

# ── 6. Verify ────────────────────────────────────────────────────────────────
echo ""
echo "🔍  Verifying installation ..."
"$VENV_DIR/bin/python" -c "
from enigma_ai.api.app import app
from enigma_ai.orchestrator import run_orchestrator
print('✅  All imports resolved. Agent is ready.')
"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║  Setup complete! Start the agent with:               ║"
echo "║    ./start-agent.sh                                  ║"
echo "║  or:                                                 ║"
echo "║    cd agent && .venv/bin/uvicorn \\                  ║"
echo "║      enigma_ai.api.app:app --reload --port 8000      ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
