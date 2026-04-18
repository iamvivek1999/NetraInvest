"""
Enigma AI - Investor Memory Layer

Reads/writes investor preferences to test.investor_memory.
Used by the Recommendation Agent to personalise scoring.

Schema: investor_memory
  userId, riskAppetite, preferredIndustries, preferredStages,
  budgetRange, pastInvestmentIds, lastUpdatedAt
"""
from datetime import datetime, timezone

from bson import ObjectId
from pymongo import MongoClient

from enigma_ai.config import MONGO_URI, DB_NAME

MEMORY_COLLECTION = "investor_memory"


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


# ─── Load investor memory ─────────────────────────────────────────────────────

def load_investor_memory(user_id: str) -> dict:
    """
    Returns stored investor preferences.
    Falls back to sensible defaults if no record exists.
    """
    client, db = _db()
    try:
        mem = db[MEMORY_COLLECTION].find_one({"userId": _safe_id(user_id)})
        if mem:
            mem.pop("_id", None)
            if "userId" in mem:
                mem["userId"] = str(mem["userId"])
            if "lastUpdatedAt" in mem and mem["lastUpdatedAt"]:
                mem["lastUpdatedAt"] = mem["lastUpdatedAt"].isoformat()
            return mem
        # Defaults for new investors
        return {
            "userId":               user_id,
            "riskAppetite":         "medium",   # low | medium | high
            "preferredIndustries":  [],
            "preferredStages":      [],
            "budgetRange":          {"min": 0, "max": None},
            "pastInvestmentIds":    [],
            "lastUpdatedAt":        None,
        }
    finally:
        client.close()


# ─── Save / update investor memory ───────────────────────────────────────────

def save_investor_memory(
    user_id: str,
    risk_appetite: str | None = None,
    preferred_industries: list[str] | None = None,
    preferred_stages: list[str] | None = None,
    budget_min: float | None = None,
    budget_max: float | None = None,
    add_investment_id: str | None = None,
) -> dict:
    """
    Upserts investor memory. Only updates provided fields.
    Returns the updated memory record.
    """
    client, db = _db()
    try:
        now = datetime.now(timezone.utc)
        updates: dict = {"lastUpdatedAt": now}

        if risk_appetite is not None:
            updates["riskAppetite"] = risk_appetite
        if preferred_industries is not None:
            updates["preferredIndustries"] = preferred_industries
        if preferred_stages is not None:
            updates["preferredStages"] = preferred_stages
        if budget_min is not None or budget_max is not None:
            existing = load_investor_memory(user_id)
            br = existing.get("budgetRange", {"min": 0, "max": None})
            if budget_min is not None:
                br["min"] = budget_min
            if budget_max is not None:
                br["max"] = budget_max
            updates["budgetRange"] = br

        mongo_update: dict = {"$set": updates}
        if add_investment_id:
            mongo_update["$addToSet"] = {
                "pastInvestmentIds": _safe_id(add_investment_id)
            }

        db[MEMORY_COLLECTION].update_one(
            {"userId": _safe_id(user_id)},
            mongo_update,
            upsert=True,
        )
        return load_investor_memory(user_id)
    finally:
        client.close()


# ─── Infer memory from past investments ───────────────────────────────────────

def infer_and_update_memory(user_id: str) -> dict:
    """
    Inspects test.investments + test.startupprofiles to auto-infer
    the investor's preferences from their history, then saves them.
    """
    client, db = _db()
    try:
        investments = list(db["investments"].find(
            {"investorUserId": _safe_id(user_id)},
            {"startupProfileId": 1, "amount": 1}
        ))

        if not investments:
            return load_investor_memory(user_id)

        industries: list[str] = []
        stages:     list[str] = []
        amounts:    list[float] = []

        for inv in investments:
            sp_id = inv.get("startupProfileId")
            if sp_id:
                sp = db["startupprofiles"].find_one(
                    {"_id": sp_id},
                    {"industry": 1, "fundingStage": 1}
                )
                if sp:
                    if sp.get("industry"):
                        industries.append(sp["industry"])
                    if sp.get("fundingStage"):
                        stages.append(sp["fundingStage"])
            if inv.get("amount"):
                amounts.append(float(inv["amount"]))

        # Infer risk appetite from average investment amount
        avg_amount = sum(amounts) / len(amounts) if amounts else 0
        if avg_amount > 50_000:
            risk = "high"
        elif avg_amount > 10_000:
            risk = "medium"
        else:
            risk = "low"

        # Deduplicate
        industries = list(set(industries))
        stages     = list(set(stages))
        inv_ids    = [str(i.get("_id", "")) for i in investments]

        return save_investor_memory(
            user_id              = user_id,
            risk_appetite        = risk,
            preferred_industries = industries,
            preferred_stages     = stages,
            budget_min           = min(amounts) if amounts else 0,
            budget_max           = max(amounts) if amounts else None,
        )
    finally:
        client.close()
