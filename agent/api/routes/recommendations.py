"""
Enigma AI - Recommendation API Routes
POST /api/recommend
"""
from fastapi import APIRouter
from fastapi.responses import JSONResponse

from enigma_ai.api.models import RecommendRequest
from enigma_ai.agents.recommendation_agent import run_recommendation_agent

router = APIRouter(prefix="/api/recommend", tags=["Recommendations"])


@router.post("", summary="Get startup recommendations for an investor")
async def recommend(body: RecommendRequest):
    try:
        result = await run_recommendation_agent(
            user_id   = body.user_id,
            user_role = body.user_role,
            raw_query = body.query,
        )
        return JSONResponse(content=result)
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e), "status": "failed"})
