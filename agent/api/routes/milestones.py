"""
Enigma AI - Milestone Evaluation API Routes
POST /api/milestone/evaluate
"""
from fastapi import APIRouter
from fastapi.responses import JSONResponse

from enigma_ai.api.models import MilestoneRequest
from enigma_ai.agents.milestone_agent import run_milestone_agent

router = APIRouter(prefix="/api/milestone", tags=["Milestones"])


@router.post("/evaluate", summary="Evaluate a milestone proof submission (triggers HITL)")
async def evaluate_milestone(body: MilestoneRequest):
    try:
        result = await run_milestone_agent(
            campaign_id     = body.campaign_id,
            milestone_index = body.milestone_index,
            user_id         = body.user_id,
            user_role       = body.user_role,
        )
        return JSONResponse(content=result)
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e), "status": "failed"})
