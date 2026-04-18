"""
Enigma AI - Admin API Routes

GET  /api/admin/hitl              - List pending HITL reviews
GET  /api/admin/hitl/{id}         - Get single HITL review detail
POST /api/admin/hitl/{id}/resolve - Resolve with approve/reject/request_more_info
GET  /api/admin/audit             - Recent audit log entries
GET  /api/admin/audit/{campaign}  - Full audit trail for a campaign
GET  /api/admin/memory/{user_id}  - View investor memory
PUT  /api/admin/memory/{user_id}  - Update investor memory
POST /api/admin/memory/{user_id}/infer - Auto-infer memory from history
GET  /api/admin/stats             - Dashboard stats (counts, health)
"""
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pymongo import MongoClient

from enigma_ai.api.models import HITLResolveRequest, MemoryUpdateRequest
from enigma_ai.hitl_store import list_pending_reviews, get_pending_review, resolve_hitl
from enigma_ai.audit import get_audit_trail
from enigma_ai.memory import load_investor_memory, save_investor_memory, infer_and_update_memory
from enigma_ai.config import MONGO_URI, DB_NAME

router = APIRouter(prefix="/api/admin", tags=["Admin"])


def _db():
    client = MongoClient(MONGO_URI)
    return client, client[DB_NAME]


# ── HITL Queue ────────────────────────────────────────────────────────────────

@router.get("/hitl", summary="List all pending HITL milestone reviews")
def list_hitl():
    return list_pending_reviews()


@router.get("/hitl/{hitl_id}", summary="Get full HITL review report")
def get_hitl(hitl_id: str):
    doc = get_pending_review(hitl_id)
    if not doc:
        raise HTTPException(status_code=404, detail=f"HITL {hitl_id} not found")
    return doc


@router.post("/hitl/{hitl_id}/resolve", summary="Admin resolves a milestone review")
def resolve(hitl_id: str, body: HITLResolveRequest):
    result = resolve_hitl(
        hitl_id       = hitl_id,
        admin_user_id = body.admin_user_id,
        decision      = body.decision,
        notes         = body.notes,
    )
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


# ── Audit Logs ────────────────────────────────────────────────────────────────

@router.get("/audit", summary="Recent audit log entries (last 50)")
def recent_audit():
    client, db = _db()
    try:
        docs = list(db["ai_audit_logs"].find(
            {},
            {"_id": 1, "eventType": 1, "agentName": 1, "userId": 1,
             "recommendation": 1, "decision": 1, "status": 1,
             "confidence": 1, "errors": 1, "createdAt": 1}
        ).sort("createdAt", -1).limit(50))
        for d in docs:
            d["_id"] = str(d["_id"])
            if d.get("userId"):
                d["userId"] = str(d["userId"])
            if d.get("createdAt"):
                d["createdAt"] = d["createdAt"].isoformat()
        return docs
    finally:
        client.close()


@router.get("/audit/{campaign_id}", summary="Full audit trail for a campaign")
def campaign_audit(campaign_id: str):
    return get_audit_trail(campaign_id)


# ── Investor Memory ───────────────────────────────────────────────────────────

@router.get("/memory/{user_id}", summary="View investor memory")
def get_memory(user_id: str):
    return load_investor_memory(user_id)


@router.put("/memory/{user_id}", summary="Update investor memory")
def update_memory(user_id: str, body: MemoryUpdateRequest):
    return save_investor_memory(
        user_id              = user_id,
        risk_appetite        = body.risk_appetite,
        preferred_industries = body.preferred_industries,
        preferred_stages     = body.preferred_stages,
        budget_min           = body.budget_min,
        budget_max           = body.budget_max,
    )


@router.post("/memory/{user_id}/infer", summary="Auto-infer investor preferences from history")
def infer_memory(user_id: str):
    return infer_and_update_memory(user_id)


# ── Dashboard Stats ───────────────────────────────────────────────────────────

@router.get("/stats", summary="Dashboard summary statistics")
def dashboard_stats():
    client, db = _db()
    try:
        pending_hitl   = db["hitl_pending"].count_documents({"status": "pending"})
        resolved_hitl  = db["hitl_pending"].count_documents({"status": {"$ne": "pending"}})
        total_audit    = db["ai_audit_logs"].count_documents({})
        ai_decisions   = db["ai_audit_logs"].count_documents({"eventType": "ai_decision"})
        admin_actions  = db["ai_audit_logs"].count_documents({"eventType": "admin_action"})
        total_investors = db["investor_memory"].count_documents({})
        total_users     = db["users"].count_documents({})
        total_startups  = db["startupprofiles"].count_documents({})
        total_campaigns = db["campaigns"].count_documents({})
        total_investments = db["investments"].count_documents({})

        # Risk distribution in HITL
        high_risk = db["hitl_pending"].count_documents({
            "status": "pending",
            "report.risks": {"$exists": True, "$ne": []}
        })

        return {
            "hitl": {
                "pending":  pending_hitl,
                "resolved": resolved_hitl,
                "highRisk": high_risk,
            },
            "audit": {
                "total":       total_audit,
                "aiDecisions": ai_decisions,
                "adminActions": admin_actions,
            },
            "platform": {
                "investors":   total_investors,
                "users":       total_users,
                "startups":    total_startups,
                "campaigns":   total_campaigns,
                "investments": total_investments,
            }
        }
    finally:
        client.close()
