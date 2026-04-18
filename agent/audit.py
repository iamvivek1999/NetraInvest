"""
Enigma AI - Audit Logger

Writes immutable audit records to test.ai_audit_logs for:
  - Every AI decision (with confidence, reasoning, data_used)
  - Every admin action (approve / reject / request_more_info)
  - Every agent run (start/end)

Schema: ai_audit_logs
  eventType, agentName, userId, campaignId, milestoneIndex,
  payload, createdAt
"""
from datetime import datetime, timezone
from bson import ObjectId
from pymongo import MongoClient

from enigma_ai.config import MONGO_URI, DB_NAME

AUDIT_COLLECTION = "ai_audit_logs"


def _db():
    client = MongoClient(MONGO_URI)
    return client, client[DB_NAME]


def _safe_id(v):
    """Convert string to ObjectId if valid, else return as-is."""
    if v and len(str(v)) == 24:
        try:
            return ObjectId(v)
        except Exception:
            pass
    return v


def log_agent_run(
    agent_name: str,
    user_id: str,
    intent: str,
    status: str,
    data_used: list[str],
    confidence: float,
    reasoning: str,
    errors: list[str] | None = None,
) -> str:
    """Log a completed agent run. Returns the inserted document _id as str."""
    client, db = _db()
    try:
        doc = {
            "eventType":  "agent_run",
            "agentName":  agent_name,
            "userId":     _safe_id(user_id),
            "intent":     intent,
            "status":     status,
            "dataUsed":   data_used,
            "confidence": confidence,
            "reasoning":  reasoning,
            "errors":     errors or [],
            "createdAt":  datetime.now(timezone.utc),
        }
        result = db[AUDIT_COLLECTION].insert_one(doc)
        return str(result.inserted_id)
    finally:
        client.close()


def log_ai_decision(
    agent_name: str,
    user_id: str,
    campaign_id: str,
    milestone_index: int | None,
    recommendation: str,          # "approve" | "reject" | "review"
    confidence: float,
    reasoning: str,
    report_snapshot: dict,
) -> str:
    """Log an AI milestone evaluation decision."""
    client, db = _db()
    try:
        doc = {
            "eventType":       "ai_decision",
            "agentName":       agent_name,
            "userId":          _safe_id(user_id),
            "campaignId":      _safe_id(campaign_id),
            "milestoneIndex":  milestone_index,
            "recommendation":  recommendation,
            "confidence":      confidence,
            "reasoning":       reasoning,
            "reportSnapshot":  report_snapshot,
            "createdAt":       datetime.now(timezone.utc),
        }
        result = db[AUDIT_COLLECTION].insert_one(doc)
        return str(result.inserted_id)
    finally:
        client.close()


def log_admin_action(
    admin_user_id: str,
    campaign_id: str,
    milestone_index: int | None,
    decision: str,                 # "approve" | "reject" | "request_more_info"
    notes: str,
    ai_audit_log_id: str,          # reference to the triggering ai_decision log
) -> str:
    """Log a human admin decision. Immutable — never updated."""
    client, db = _db()
    try:
        doc = {
            "eventType":      "admin_action",
            "adminUserId":    _safe_id(admin_user_id),
            "campaignId":     _safe_id(campaign_id),
            "milestoneIndex": milestone_index,
            "decision":       decision,
            "notes":          notes,
            "aiAuditLogId":   _safe_id(ai_audit_log_id),
            "createdAt":      datetime.now(timezone.utc),
        }
        result = db[AUDIT_COLLECTION].insert_one(doc)
        return str(result.inserted_id)
    finally:
        client.close()


def get_audit_trail(campaign_id: str, milestone_index: int | None = None) -> list[dict]:
    """Fetch full audit history for a campaign/milestone."""
    client, db = _db()
    try:
        query: dict = {"campaignId": _safe_id(campaign_id)}
        if milestone_index is not None:
            query["milestoneIndex"] = milestone_index
        docs = list(db[AUDIT_COLLECTION].find(
            query,
            {"_id": 1, "eventType": 1, "agentName": 1, "recommendation": 1,
             "decision": 1, "confidence": 1, "reasoning": 1,
             "notes": 1, "createdAt": 1}
        ).sort("createdAt", 1))
        for d in docs:
            d["_id"] = str(d["_id"])
            if "createdAt" in d:
                d["createdAt"] = d["createdAt"].isoformat()
        return docs
    finally:
        client.close()
