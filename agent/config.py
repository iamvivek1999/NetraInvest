"""
Enigma AI - Shared Configuration
"""
import os
from dotenv import load_dotenv

load_dotenv()

# MongoDB — read from env; falls back to Atlas URI for backward-compat
MONGO_URI = os.getenv(
    "MONGO_URI",
    "mongodb+srv://viveklaptop2023_db_user:Eu0rDDe060Oalm7T@cluster0.mer6aey.mongodb.net/?appName=Cluster0"
)
DB_NAME = os.getenv("DB_NAME", "test")

# LLM
LLM_MODEL = os.getenv("LLM_MODEL", "gemini-2.5-flash")

# Scoring weights (Recommendation Agent)
SCORING_WEIGHTS = {
    "team_strength":       0.25,
    "milestone_completion":0.30,
    "funding_progress":    0.20,
    "market_fit":          0.15,
    "risk_penalty":        0.10,
}

# Risk thresholds (Milestone Agent)
MILESTONE_DELAY_RISK_DAYS = 14   # > 14 days late → HIGH risk
