from enigma_ai.config import MONGO_URI, DB_NAME
from pymongo import MongoClient
import json

client = MongoClient(MONGO_URI)
db = client[DB_NAME]

print("\n=== ai_audit_logs ===")
for doc in db["ai_audit_logs"].find({}, {"_id": 1, "eventType": 1, "agentName": 1,
    "recommendation": 1, "status": 1, "confidence": 1, "createdAt": 1}):
    doc["_id"] = str(doc["_id"])
    doc["createdAt"] = doc["createdAt"].isoformat() if doc.get("createdAt") else None
    print(json.dumps(doc, indent=2))

print("\n=== hitl_pending ===")
for doc in db["hitl_pending"].find({}, {"_id": 1, "campaignId": 1, "milestoneIndex": 1,
    "status": 1, "createdAt": 1, "report.recommendation": 1, "report.milestone": 1}):
    doc["_id"] = str(doc["_id"])
    doc["campaignId"] = str(doc.get("campaignId", ""))
    doc["createdAt"] = doc["createdAt"].isoformat() if doc.get("createdAt") else None
    print(json.dumps(doc, indent=2))

print("\n=== investor_memory ===")
for doc in db["investor_memory"].find({}, {"_id": 0, "userId": 1, "riskAppetite": 1,
    "preferredIndustries": 1, "preferredStages": 1, "lastUpdatedAt": 1}):
    doc["userId"] = str(doc.get("userId", ""))
    doc["lastUpdatedAt"] = doc["lastUpdatedAt"].isoformat() if doc.get("lastUpdatedAt") else None
    print(json.dumps(doc, indent=2))

client.close()
