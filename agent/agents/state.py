"""
Enigma AI - Shared LangGraph State Definition
All agents read/write this state object.
"""
from typing import Any, TypedDict


class EnigmaState(TypedDict, total=False):
    # Identity
    userId: str
    userRole: str           # "investor" | "admin" | "startup"

    # Routing
    intent: str             # "find_startups" | "evaluate_milestone" | "portfolio_status"

    # Input filters / context
    filters: dict[str, Any]

    # Raw data fetched from MongoDB
    data: dict[str, Any]

    # Intermediate analysis results
    analysis: dict[str, Any]

    # Final structured response
    result: dict[str, Any]

    # Audit / traceability
    data_used: list[str]    # descriptions of data sources used
    reasoning: str          # step-by-step chain of thought
    confidence: float       # 0.0 – 1.0

    # Error handling
    errors: list[str]
    status: str             # "ok" | "failed" | "needs_clarification" | "pending_human"
