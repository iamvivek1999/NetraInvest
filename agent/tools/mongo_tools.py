"""
Enigma AI - MongoDB Tools (LangChain @tool wrappers)

All four mandatory tools from the spec + helpers.
Connection pattern mirrors mongo_agent.py.
"""
import json
from datetime import datetime, timezone
from bson import ObjectId
from pymongo import MongoClient
from langchain_core.tools import tool

from enigma_ai.config import MONGO_URI, DB_NAME


# ─── helpers ──────────────────────────────────────────────────────────────────

def _get_db():
    client = MongoClient(MONGO_URI)
    return client, client[DB_NAME]


def _serialize(doc: dict) -> dict:
    """Recursively convert ObjectId / datetime to plain strings."""
    if doc is None:
        return {}
    out = {}
    for k, v in doc.items():
        if isinstance(v, ObjectId):
            out[k] = str(v)
        elif isinstance(v, datetime):
            out[k] = v.isoformat()
        elif isinstance(v, dict):
            out[k] = _serialize(v)
        elif isinstance(v, list):
            out[k] = [_serialize(i) if isinstance(i, dict) else str(i) if isinstance(i, ObjectId) else i for i in v]
        else:
            out[k] = v
    return out


# ─── TOOL 1: get_startups ─────────────────────────────────────────────────────

@tool
def get_startups(filters_json: str = "{}") -> str:
    """
    Fetch startup profiles from MongoDB, optionally filtered.
    filters_json: JSON string with keys like industry, fundingStage, tags (list).
    Returns a JSON list of startups with their active campaign summary.
    """
    filters: dict = json.loads(filters_json) if filters_json else {}

    mongo_filter = {}
    if "industry" in filters:
        mongo_filter["industry"] = {"$regex": filters["industry"], "$options": "i"}
    if "fundingStage" in filters:
        mongo_filter["fundingStage"] = filters["fundingStage"]
    if "tags" in filters and filters["tags"]:
        mongo_filter["tags"] = {"$in": filters["tags"]}

    client, db = _get_db()
    try:
        startups_col  = db["startupprofiles"]
        campaigns_col = db["campaigns"]

        startups = list(startups_col.find(mongo_filter, {"_id": 1, "userId": 1,
            "startupName": 1, "industry": 1, "fundingStage": 1,
            "teamSize": 1, "tags": 1, "isVerified": 1, "tagline": 1}))

        result = []
        for s in startups:
            startup_id = s["_id"]
            # Join with active campaign
            campaign = campaigns_col.find_one(
                {"startupProfileId": startup_id},
                {"_id": 1, "fundingGoal": 1, "currentRaised": 1,
                 "milestoneCount": 1, "status": 1, "currentMilestoneIndex": 1,
                 "title": 1, "deadline": 1}
            )
            entry = _serialize(s)
            entry["campaign"] = _serialize(campaign) if campaign else {}
            result.append(entry)

        return json.dumps(result, indent=2)
    finally:
        client.close()


# ─── TOOL 2: get_campaign_details ────────────────────────────────────────────

@tool
def get_campaign_details(campaign_id: str) -> str:
    """
    Fetch full details of a single campaign including milestones and investor count.
    campaign_id: MongoDB ObjectId string of the campaign.
    Returns JSON with fundingGoal, currentRaised, milestones, status.
    """
    client, db = _get_db()
    try:
        campaigns_col  = db["campaigns"]
        milestones_col = db["milestones"]

        campaign = campaigns_col.find_one({"_id": ObjectId(campaign_id)})
        if not campaign:
            return json.dumps({"error": f"Campaign {campaign_id} not found"})

        milestones = list(milestones_col.find(
            {"campaignId": ObjectId(campaign_id)},
            {"_id": 0, "index": 1, "title": 1, "status": 1, "percentage": 1,
             "targetDate": 1, "proofSubmission": 1, "disbursedAmount": 1}
        ))

        result = _serialize(campaign)
        result["milestones"] = [_serialize(m) for m in milestones]
        return json.dumps(result, indent=2)
    finally:
        client.close()


# ─── TOOL 3: get_milestones ──────────────────────────────────────────────────

@tool
def get_milestones(campaign_id: str) -> str:
    """
    Fetch all milestones for a campaign.
    campaign_id: MongoDB ObjectId string.
    Returns JSON list with index, title, status, percentage, targetDate,
    proofSubmission, disbursedAmount.
    """
    client, db = _get_db()
    try:
        milestones_col = db["milestones"]
        milestones = list(milestones_col.find(
            {"campaignId": ObjectId(campaign_id)},
            {"_id": 1, "index": 1, "title": 1, "status": 1,
             "percentage": 1, "targetDate": 1, "proofSubmission": 1,
             "disbursedAmount": 1, "description": 1, "estimatedAmount": 1,
             "approvedAt": 1, "rejectionReason": 1}
        ))
        return json.dumps([_serialize(m) for m in milestones], indent=2)
    finally:
        client.close()


# ─── TOOL 4: get_investor_portfolio ──────────────────────────────────────────

@tool
def get_investor_portfolio(user_id: str) -> str:
    """
    Fetch all investments made by an investor user.
    user_id: MongoDB ObjectId string of the investor user.
    Returns JSON list with startupName, amount, campaignId, status,
    currentMilestoneIndex.
    """
    client, db = _get_db()
    try:
        investments_col = db["investments"]
        campaigns_col   = db["campaigns"]
        startups_col    = db["startupprofiles"]

        investments = list(investments_col.find(
            {"investorUserId": ObjectId(user_id)},
            {"_id": 1, "campaignId": 1, "startupProfileId": 1,
             "amount": 1, "currency": 1, "status": 1, "createdAt": 1,
             "blockchainStatus": 1}
        ))

        result = []
        for inv in investments:
            entry = _serialize(inv)
            # Enrich with campaign info
            campaign = campaigns_col.find_one(
                {"_id": inv.get("campaignId")},
                {"title": 1, "currentMilestoneIndex": 1, "status": 1,
                 "milestoneCount": 1, "currentRaised": 1, "fundingGoal": 1}
            )
            # Enrich with startup name
            startup = startups_col.find_one(
                {"_id": inv.get("startupProfileId")},
                {"startupName": 1, "industry": 1}
            )
            entry["campaign"]    = _serialize(campaign) if campaign else {}
            entry["startupName"] = startup.get("startupName", "Unknown") if startup else "Unknown"
            entry["industry"]    = startup.get("industry", "") if startup else ""
            result.append(entry)

        return json.dumps(result, indent=2)
    finally:
        client.close()


# ─── TOOL 5: get_all_campaigns ───────────────────────────────────────────────

@tool
def get_all_campaigns(status_filter: str = "") -> str:
    """
    Fetch all campaigns. Optionally filter by status (active, closed, draft).
    Returns JSON list with id, title, startupProfileId, fundingGoal,
    currentRaised, status, milestoneCount, currentMilestoneIndex.
    """
    client, db = _get_db()
    try:
        campaigns_col = db["campaigns"]
        mongo_filter = {}
        if status_filter:
            mongo_filter["status"] = status_filter

        campaigns = list(campaigns_col.find(mongo_filter, {
            "_id": 1, "title": 1, "startupProfileId": 1,
            "fundingGoal": 1, "currentRaised": 1, "status": 1,
            "milestoneCount": 1, "currentMilestoneIndex": 1,
            "investorCount": 1, "deadline": 1, "currency": 1
        }))
        return json.dumps([_serialize(c) for c in campaigns], indent=2)
    finally:
        client.close()


# ─── TOOL 6: get_startup_by_id ───────────────────────────────────────────────

@tool
def get_startup_by_id(startup_id: str) -> str:
    """
    Fetch a single startup profile by its ObjectId string.
    Returns full startup profile JSON.
    """
    client, db = _get_db()
    try:
        startups_col = db["startupprofiles"]
        s = startups_col.find_one({"_id": ObjectId(startup_id)})
        return json.dumps(_serialize(s) if s else {"error": "Not found"}, indent=2)
    finally:
        client.close()


@tool
def get_startup_categories() -> str:
    """Returns distinct industries/categories from startupprofiles as a JSON string."""
    client, db = _get_db()
    try:
        res = db.startupprofiles.distinct("industry")
        return json.dumps(res)
    finally:
        client.close()

@tool
def find_documents(collection: str, query: dict = None, projection: dict = None) -> str:
    """
    Generic tool to query any MongoDB collection.
    collection: name of the collection ('startupprofiles', 'campaigns', 'investments', 'users', 'investorprofile', 'milestones')
    query: MongoDB query filter as a JSON object/dictionary (e.g. {"startupName": "Startup Five"}).
    projection: Optional projection dictionary.
    Returns up to 50 matching documents as a JSON string.
    """
    client, db = _get_db()
    try:
        col = db[collection]
        q = query or {}
        p = projection or None
        
        # Convert ObjectIds if specifically queried
        if "_id" in q and isinstance(q["_id"], str):
            q["_id"] = ObjectId(q["_id"])
        for key in ["startupProfileId", "campaignId", "userId", "investorUserId"]:
            if key in q and isinstance(q[key], str):
                q[key] = ObjectId(q[key])
                
        docs = list(col.find(q, p).limit(50))
        return json.dumps([_serialize(d) for d in docs], indent=2)
    except Exception as e:
        return json.dumps({"error": str(e)})
    finally:
        client.close()

# ─── All tools list (import-ready) ───────────────────────────────────────────

ALL_TOOLS = [
    get_startups,
    get_campaign_details,
    get_milestones,
    get_investor_portfolio,
    get_all_campaigns,
    get_startup_by_id,
    get_startup_categories,
    find_documents,
]

# ─── Non-tool Helpers ────────────────────────────────────────────────────────

def get_user_id_by_name(name: str) -> str | None:
    """Finds a user's ObjectId based on their full name (case insensitive regex)"""
    client, db = _get_db()
    try:
        user = db.users.find_one({"fullName": {"$regex": name, "$options": "i"}})
        if user:
            return str(user["_id"])
        return None
    finally:
        client.close()
