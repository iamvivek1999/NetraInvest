"""
Enigma AI - FastAPI Application

Run with:
    PYTHONPATH=/home/natalie/Data/Enigma uvicorn enigma_ai.api.app:app --reload --port 8000
"""
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from enigma_ai.api.routes.recommendations import router as rec_router
from enigma_ai.api.routes.portfolio import router as port_router
from enigma_ai.api.routes.milestones import router as ms_router
from enigma_ai.api.routes.admin import router as admin_router
from enigma_ai.api.routes.chat import router as chat_router

# ── App setup ─────────────────────────────────────────────────────────────────

app = FastAPI(
    title       = "Enigma AI — Multi-Agent Investment API",
    description = "LangGraph + MongoDB + Gemini 2.5 powered investment intelligence.",
    version     = "1.0.0",
    docs_url    = "/docs",
    redoc_url   = "/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins     = ["*"],
    allow_credentials = True,
    allow_methods     = ["*"],
    allow_headers     = ["*"],
)

# ── Register routers ──────────────────────────────────────────────────────────

app.include_router(rec_router)
app.include_router(port_router)
app.include_router(ms_router)
app.include_router(admin_router)
app.include_router(chat_router)

# ── Serve admin dashboard ─────────────────────────────────────────────────────

DASHBOARD_PATH = Path(__file__).parent / "dashboard.html"

@app.get("/", include_in_schema=False)
def serve_dashboard():
    return FileResponse(str(DASHBOARD_PATH))


# ── Health check ──────────────────────────────────────────────────────────────

@app.get("/health", tags=["System"])
def health():
    return {"status": "ok", "service": "enigma-ai"}
