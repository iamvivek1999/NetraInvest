"""
Enigma AI - Portfolio API Routes
POST /api/portfolio
"""
from fastapi import APIRouter
from fastapi.responses import JSONResponse

from enigma_ai.api.models import PortfolioRequest
from enigma_ai.agents.portfolio_agent import run_portfolio_agent

router = APIRouter(prefix="/api/portfolio", tags=["Portfolio"])


@router.post("", summary="Get investor portfolio health analysis")
async def portfolio(body: PortfolioRequest):
    try:
        result = await run_portfolio_agent(
            user_id   = body.user_id,
            user_role = body.user_role,
        )
        return JSONResponse(content=result)
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e), "status": "failed"})
