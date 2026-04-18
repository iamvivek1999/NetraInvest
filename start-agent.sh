#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# start-agent.sh  — Start the Enigma AI FastAPI server
#
# Uses the local .venv inside agent/ directory.
# Run from repo root:  bash start-agent.sh
#
# First-time setup (already done if .venv exists):
#   cd agent && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
# ─────────────────────────────────────────────────────────────────────────────

AGENT_DIR="/home/natalie/Data/NetraInvest/agent"
UVICORN="$AGENT_DIR/.venv/bin/uvicorn"

if [ ! -f "$UVICORN" ]; then
  echo "❌ .venv not found. Run inside agent/:"
  echo "   python3 -m venv .venv && .venv/bin/pip install -r requirements.txt"
  exit 1
fi

echo "🤖 Enigma AI Agent starting..."
echo "   URL  → http://localhost:8000"
echo "   Docs → http://localhost:8000/docs"
echo "   Health → http://localhost:8000/health"
echo ""

# Run uvicorn with agent/ as the working directory so relative imports resolve
cd "$AGENT_DIR" && \
  "$UVICORN" agent.api.app:app \
    --reload \
    --host 0.0.0.0 \
    --port 8000 \
    --log-level info
