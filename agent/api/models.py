"""
Enigma AI - Pydantic Request / Response Models
"""
from typing import Any, Literal
from pydantic import BaseModel, Field


# ── Shared ────────────────────────────────────────────────────────────────────

class ErrorResponse(BaseModel):
    error: str
    status: str = "failed"


class MetaBlock(BaseModel):
    data_used:  list[str] = []
    confidence: float     = 0.0
    reasoning:  str       = ""


# ── Recommendation Agent ──────────────────────────────────────────────────────

class RecommendRequest(BaseModel):
    user_id:   str = Field(..., description="Investor user ObjectId")
    user_role: str = Field("investor")
    query:     str = Field(..., description="Natural language investment query")


class StartupRec(BaseModel):
    startupName: str
    score:       float
    why_it_fits: str
    risks:       list[str]


class RecommendResponse(BaseModel):
    recommendations: list[StartupRec]
    topPick:         str | None
    comparison:      str
    risks:           list[str]
    confidence:      float
    reasoning:       str
    _meta:           MetaBlock | None = None


# ── Portfolio Agent ───────────────────────────────────────────────────────────

class PortfolioRequest(BaseModel):
    user_id:   str = Field(..., description="Investor user ObjectId")
    user_role: str = Field("investor")


class PortfolioDetail(BaseModel):
    startupName:          str
    industry:             str
    amount:               float
    currency:             str
    investment_status:    str
    campaign_status:      str
    milestones_total:     int
    milestones_completed: int
    progress_pct:         float
    delayed_days:         int
    risk_level:           str


class PortfolioSummary(BaseModel):
    totalInvested:       float
    avgProgress:         float
    totalInvestments:    int
    highRiskInvestments: list[str]


class PortfolioResponse(BaseModel):
    portfolioSummary: PortfolioSummary
    details:          list[PortfolioDetail]
    alerts:           list[str]


# ── Milestone Agent ───────────────────────────────────────────────────────────

class MilestoneRequest(BaseModel):
    campaign_id:     str = Field(..., description="Campaign ObjectId")
    milestone_index: int | None = Field(None, description="0-based index. None = first pending.")
    user_id:         str = Field("")
    user_role:       str = Field("admin")


class MilestoneResponse(BaseModel):
    milestone:          str
    completion_status:  str
    confidence:         float
    risks:              list[str]
    redFlags:           list[str]
    recommendation:     str
    explanation:        str
    _meta:              dict | None = None


# ── HITL Admin ────────────────────────────────────────────────────────────────

class HITLListItem(BaseModel):
    id:               str = Field(alias="_id")
    campaignId:       str
    milestoneIndex:   int | None
    recommendation:   str | None
    completion_status: str | None
    confidence:       float | None
    createdAt:        str

    class Config:
        populate_by_name = True


class HITLResolveRequest(BaseModel):
    admin_user_id: str
    decision:      Literal["approve", "reject", "request_more_info"]
    notes:         str = ""


class AuditEntry(BaseModel):
    id:             str = Field(alias="_id")
    eventType:      str
    agentName:      str | None
    recommendation: str | None
    decision:       str | None
    confidence:     float | None
    createdAt:      str

    class Config:
        populate_by_name = True


# ── Investor Memory ───────────────────────────────────────────────────────────

class MemoryUpdateRequest(BaseModel):
    risk_appetite:        str | None = None
    preferred_industries: list[str] | None = None
    preferred_stages:     list[str] | None = None
    budget_min:           float | None = None
    budget_max:           float | None = None
