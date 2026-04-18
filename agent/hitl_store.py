"""
Enigma AI - HITL Persistence Layer

Saves pending milestone evaluations to test.hitl_pending so admins
can review and resolve them asynchronously (e.g. via an API endpoint).

Schema: hitl_pending
  campaignId, milestoneIndex, report, state_snapshot,
  status (pending | resolved), resolvedAt, adminDecision,
  adminNotes, aiAuditLogId, createdAt, updatedAt
"""
import json
from datetime import datetime, timezone
from typing import Literal

from bson import ObjectId
from pymongo import MongoClient, ASCENDING

from enigma_ai.config import MONGO_URI, DB_NAME
from enigma_ai.audit import log_admin_action

HITL_COLLECTION = "hitl_pending"


def _db():
    client = MongoClient(MONGO_URI)
    return client, client[DB_NAME]


def _safe_id(v):
    if v and len(str(v)) == 24:
        try:
            return ObjectId(v)
        except Exception:
            pass
    return v


def _ensure_indexes(db):
    col = db[HITL_COLLECTION]
    col.create_index([("campaignId", ASCENDING), ("milestoneIndex", ASCENDING)])
    col.create_index([("status", ASCENDING)])


# ─── Save pending review ──────────────────────────────────────────────────────

def save_pending_review(
    campaign_id: str,
    milestone_index: int | None,
    report: dict,
    ai_audit_log_id: str = "",
) -> str:
    """
    Persists a milestone evaluation report awaiting admin review.
    Returns the _id of the hitl_pending document.
    """
    client, db = _db()
    _ensure_indexes(db)
    try:
        now = datetime.now(timezone.utc)
        # Upsert: if same campaign/milestone already pending, update in place
        doc = {
            "campaignId":     _safe_id(campaign_id),
            "milestoneIndex": milestone_index,
            "report":         report,
            "aiAuditLogId":   _safe_id(ai_audit_log_id) if ai_audit_log_id else None,
            "status":         "pending",
            "resolvedAt":     None,
            "adminDecision":  None,
            "adminNotes":     None,
            "createdAt":      now,
            "updatedAt":      now,
        }
        result = db[HITL_COLLECTION].update_one(
            {"campaignId": _safe_id(campaign_id), "milestoneIndex": milestone_index,
             "status": "pending"},
            {"$set": doc},
            upsert=True,
        )
        if result.upserted_id:
            return str(result.upserted_id)
        # Return existing _id
        existing = db[HITL_COLLECTION].find_one(
            {"campaignId": _safe_id(campaign_id),
             "milestoneIndex": milestone_index, "status": "pending"},
            {"_id": 1}
        )
        return str(existing["_id"]) if existing else ""
    finally:
        client.close()


# ─── List pending reviews ─────────────────────────────────────────────────────

def list_pending_reviews() -> list[dict]:
    """Returns all unresolved HITL items for the admin dashboard."""
    client, db = _db()
    try:
        docs = list(db[HITL_COLLECTION].find(
            {"status": "pending"},
            {"_id": 1, "campaignId": 1, "milestoneIndex": 1,
             "report.milestone": 1, "report.completion_status": 1,
             "report.confidence": 1, "report.recommendation": 1,
             "createdAt": 1}
        ).sort("createdAt", ASCENDING))
        for d in docs:
            d["_id"]        = str(d["_id"])
            d["campaignId"] = str(d.get("campaignId", ""))
            if "createdAt" in d:
                d["createdAt"] = d["createdAt"].isoformat()
        return docs
    finally:
        client.close()


# ─── Get single pending review ────────────────────────────────────────────────

def get_pending_review(hitl_id: str) -> dict | None:
    """Fetch full pending review by its _id."""
    client, db = _db()
    try:
        doc = db[HITL_COLLECTION].find_one({"_id": ObjectId(hitl_id)})
        if not doc:
            return None
        doc["_id"]        = str(doc["_id"])
        doc["campaignId"] = str(doc.get("campaignId", ""))
        if doc.get("aiAuditLogId"):
            doc["aiAuditLogId"] = str(doc["aiAuditLogId"])
        for f in ("createdAt", "updatedAt", "resolvedAt"):
            if doc.get(f):
                doc[f] = doc[f].isoformat()
        return doc
    finally:
        client.close()


# ─── Resolve a pending review (admin action) ──────────────────────────────────

def resolve_hitl(
    hitl_id: str,
    admin_user_id: str,
    decision: Literal["approve", "reject", "request_more_info"],
    notes: str = "",
) -> dict:
    """
    Called by admin to formally resolve a pending milestone review.
    This is the ONLY path to milestone approval.
    Returns updated document summary.
    """
    client, db = _db()
    try:
        doc = db[HITL_COLLECTION].find_one({"_id": ObjectId(hitl_id)})
        if not doc:
            return {"error": f"HITL item {hitl_id} not found"}
        if doc.get("status") != "pending":
            return {"error": f"HITL item {hitl_id} is already resolved: {doc.get('status')}"}

        now = datetime.now(timezone.utc)
        db[HITL_COLLECTION].update_one(
            {"_id": ObjectId(hitl_id)},
            {"$set": {
                "status":        f"resolved_{decision}",
                "adminDecision": decision,
                "adminNotes":    notes,
                "adminUserId":   _safe_id(admin_user_id),
                "resolvedAt":    now,
                "updatedAt":     now,
            }}
        )

        # Write to immutable audit log
        ai_audit_log_id = str(doc.get("aiAuditLogId", "")) or ""
        log_admin_action(
            admin_user_id    = admin_user_id,
            campaign_id      = str(doc.get("campaignId", "")),
            milestone_index  = doc.get("milestoneIndex"),
            decision         = decision,
            notes            = notes,
            ai_audit_log_id  = ai_audit_log_id,
        )

        return {
            "hitlId":        hitl_id,
            "campaignId":    str(doc.get("campaignId", "")),
            "decision":      decision,
            "notes":         notes,
            "resolvedAt":    now.isoformat(),
        }
    finally:
        client.close()
