"""
Enigma AI - Agent 1: Startup Recommendation Flow

Graph:
    User Input
      ↓ intent_parser (LLM)
      ↓ filter_builder (deterministic)
      ↓ mongo_query (tool call)
      ↓ ranking_engine (deterministic scoring, NO LLM)
      ↓ llm_explainer (LLM)
      ↓ response_formatter
"""
import json
import math
from datetime import datetime, timezone
from typing import Any

from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import StateGraph, END

from enigma_ai.agents.state import EnigmaState
from enigma_ai.config import LLM_MODEL, SCORING_WEIGHTS
from enigma_ai.tools.mongo_tools import get_startups
from enigma_ai.memory import load_investor_memory, save_investor_memory
from enigma_ai.audit import log_agent_run


# ─── LLM singleton ────────────────────────────────────────────────────────────

def _llm() -> ChatGoogleGenerativeAI:
    return ChatGoogleGenerativeAI(
        model=LLM_MODEL,
        temperature=0.1,
    )


# ─── NODE 1: Intent Parser ────────────────────────────────────────────────────

def intent_parser(state: EnigmaState) -> EnigmaState:
    """Load investor memory, then LLM extracts structured intent from query."""
    query = state.get("filters", {}).get("raw_query", "")
    if not query:
        return {**state, "errors": state.get("errors", []) + ["No query provided"], "status": "failed"}

    # ── Load investor memory to seed defaults ──────────────────────────────
    user_id = state.get("userId", "")
    memory  = load_investor_memory(user_id) if user_id else {}

    prompt = f"""You are an intent parser for an investment platform.
Extract the investment intent from the user query below.

Investor's stored preferences (use as defaults if query doesn't mention them):
- Risk appetite: {memory.get('riskAppetite', 'unknown')}
- Preferred industries: {memory.get('preferredIndustries', [])}
- Preferred stages: {memory.get('preferredStages', [])}
- Budget range: {memory.get('budgetRange', {})}

Query: {query}

Return ONLY valid JSON with these keys (use null if not mentioned AND no default applies):
{{
  "industry": "<string or null>",
  "budget": "<number in USD or null>",
  "riskLevel": "<low|medium|high or null>",
  "fundingStage": "<pre-seed|seed|series-a|series-b or null>",
  "location": "<string or null>",
  "tags": ["<tag1>", "<tag2>"]
}}

Safety rules:
- Use only provided data
- Do not assume missing values
- If unsure → use null
- Output JSON only"""

    llm = _llm()
    response = llm.invoke(prompt)
    raw = response.content.strip().strip("```json").strip("```").strip()

    try:
        intent = json.loads(raw)
    except json.JSONDecodeError:
        return {**state, "errors": state.get("errors", []) + [f"Intent parse failed: {raw}"], "status": "failed"}

    return {
        **state,
        "intent":    "find_startups",
        "filters":   {**state.get("filters", {}), **intent, "_memory": memory},
        "data_used": state.get("data_used", []) + ["user_query", "investor_memory"],
        "status":    "ok",
    }


# ─── NODE 2: Filter Builder ──────────────────────────────────────────────────

def filter_builder(state: EnigmaState) -> EnigmaState:
    """Deterministic: maps parsed intent → MongoDB query filter dict."""
    f = state.get("filters", {})
    mongo_filter: dict[str, Any] = {}

    if f.get("industry"):
        mongo_filter["industry"] = f["industry"]
    if f.get("fundingStage"):
        mongo_filter["fundingStage"] = f["fundingStage"]
    if f.get("tags"):
        mongo_filter["tags"] = f["tags"]

    return {
        **state,
        "filters": {**f, "mongo_filter": mongo_filter},
        "status": "ok",
    }


# ─── NODE 3: Mongo Query ─────────────────────────────────────────────────────

def mongo_query(state: EnigmaState) -> EnigmaState:
    """Calls get_startups tool with the built filter."""
    mongo_filter = state.get("filters", {}).get("mongo_filter", {})
    print(f"[DEBUG] mongo_query filter: {mongo_filter}")
    raw = get_startups.invoke({"filters_json": json.dumps(mongo_filter)})

    try:
        startups = json.loads(raw)
        print(f"[DEBUG] mongo_query found {len(startups)} startups")
    except Exception as e:
        return {**state, "errors": state.get("errors", []) + [str(e)], "status": "failed"}

    return {
        **state,
        "data": {**state.get("data", {}), "startups": startups},
        "data_used": state.get("data_used", []) + ["startupprofiles", "campaigns"],
        "status": "ok",
    }


# ─── NODE 4: Ranking Engine (NO LLM) ─────────────────────────────────────────

def _score_startup(startup: dict, budget: float | None, memory: dict | None = None) -> float:
    """
    Deterministic scoring formula (spec §3) with optional memory-based weight adjustments:
    score = (teamStrength * 0.25) + (milestoneCompletion * 0.30)
          + (fundingProgress * 0.20) + (marketFit * 0.15)
          - (riskPenalty * 0.10)
    All sub-scores in [0, 1].
    """
    w = dict(SCORING_WEIGHTS)  # copy so we don't mutate config
    campaign = startup.get("campaign", {})

    # ── Memory-based weight adjustments ───────────────────────────────────
    if memory:
        risk = memory.get("riskAppetite", "medium")
        if risk == "low":
            # Conservative: care more about milestone completion and less about market fit
            w["milestone_completion"] += 0.05
            w["market_fit"]           -= 0.05
        elif risk == "high":
            # Aggressive: care more about market fit, less milestone proof
            w["market_fit"]           += 0.05
            w["milestone_completion"] -= 0.05

        # Boost startups in preferred industries
        if startup.get("industry") in memory.get("preferredIndustries", []):
            w["market_fit"] = min(w["market_fit"] + 0.05, 0.35)

    # Team strength: normalise teamSize (cap at 50)
    team_size = startup.get("teamSize", 1) or 1
    team_strength = min(team_size / 50.0, 1.0)

    # Milestone completion
    milestone_count   = campaign.get("milestoneCount", 0) or 0
    current_milestone = campaign.get("currentMilestoneIndex", 0) or 0
    milestone_completion = (current_milestone / milestone_count) if milestone_count > 0 else 0.0

    # Funding progress
    goal    = campaign.get("fundingGoal", 1) or 1
    raised  = campaign.get("currentRaised", 0) or 0
    funding_progress = min(raised / goal, 1.0)

    # Market fit: verified startups score higher; tags increase score
    is_verified = 1.0 if startup.get("isVerified") else 0.3
    tag_bonus   = min(len(startup.get("tags", [])) * 0.1, 0.5)
    market_fit  = min(is_verified * 0.5 + tag_bonus, 1.0)

    # Risk penalty: budget mismatch
    risk_penalty = 0.0
    min_investment = campaign.get("minInvestment", 0) or 0
    if budget and min_investment and budget < min_investment:
        risk_penalty = 1.0   # investor can't afford it

    score = (
        team_strength        * w["team_strength"]        +
        milestone_completion * w["milestone_completion"]  +
        funding_progress     * w["funding_progress"]      +
        market_fit           * w["market_fit"]            -
        risk_penalty         * w["risk_penalty"]
    )
    return round(max(score, 0.0), 4)


def ranking_engine(state: EnigmaState) -> EnigmaState:
    """Scores every startup deterministically (memory-adjusted weights) and sorts descending."""
    startups = state.get("data", {}).get("startups", [])
    budget   = state.get("filters", {}).get("budget")
    memory   = state.get("filters", {}).get("_memory", {})

    if budget:
        try:
            budget = float(str(budget).replace(",", "").replace("$", ""))
        except ValueError:
            budget = None

    for s in startups:
        s["_score"] = _score_startup(s, budget, memory)

    ranked = sorted(startups, key=lambda x: x["_score"], reverse=True)

    return {
        **state,
        "data": {**state.get("data", {}), "ranked_startups": ranked},
        "status": "ok",
    }


# ─── NODE 5: LLM Explainer ───────────────────────────────────────────────────

def llm_explainer(state: EnigmaState) -> EnigmaState:
    """LLM generates human-readable explanation for top 5 recommendations."""
    ranked = state.get("data", {}).get("ranked_startups", [])
    top5   = ranked[:5]

    if not top5:
        return {**state, "result": {"recommendations": [], "topPick": None,
                "comparison": "No startups found matching your criteria.",
                "risks": [], "confidence": 0.0}, "status": "ok"}

    # Prepare a sanitised snapshot for the LLM (no ObjectId issues)
    snapshot = json.dumps(top5, indent=2, default=str)
    filters  = {k: v for k, v in state.get("filters", {}).items()
                if k not in ("mongo_filter", "raw_query")}

    prompt = f"""You are an investment advisor AI for the Enigma platform.

Investor preferences: {json.dumps(filters)}

Top startup candidates (pre-scored, do NOT re-score):
{snapshot}

Explain:
1. Why each startup matches the investor's criteria
2. Key differences between the options
3. Risks involved with each
4. Your recommended top pick and why

Safety rules:
- Use ONLY the data provided above
- Do not assume or invent any missing values
- If data is insufficient → say "insufficient data"
- Output strict JSON only, no markdown outside JSON
- MANDATORY: You MUST include EVERY startup from the 'Top startup candidates' list in the `recommendations` array, even if they have risks or don't perfectly match the preferences.

Return ONLY this JSON:
{{
  "recommendations": [
    {{
      "startupName": "",
      "score": 0.0,
      "why_it_fits": "",
      "risks": [""]
    }}
  ],
  "topPick": "<startupName>",
  "comparison": "<paragraph comparing options>",
  "risks": ["<global risk 1>", "<global risk 2>"],
  "confidence": 0.0,
  "reasoning": "<step by step reasoning>"
}}"""

    llm = _llm()
    response = llm.invoke(prompt)
    raw = response.content.strip().strip("```json").strip("```").strip()

    try:
        explanation = json.loads(raw)
    except json.JSONDecodeError:
        # Fallback: return raw text wrapped
        explanation = {
            "recommendations": [{"startupName": s.get("startupName", ""), "score": s["_score"],
                                  "why_it_fits": "insufficient data", "risks": []} for s in top5],
            "topPick": top5[0].get("startupName", ""),
            "comparison": raw,
            "risks": [],
            "confidence": 0.5,
            "reasoning": "LLM parse error — raw response attached in comparison field",
        }

    return {
        **state,
        "result":     explanation,
        "confidence": explanation.get("confidence", 0.5),
        "reasoning":  explanation.get("reasoning", ""),
        "status":     "ok",
    }


# ─── NODE 6: Response Formatter ──────────────────────────────────────────────

def response_formatter(state: EnigmaState) -> EnigmaState:
    """Attaches explainability envelope and saves preferences to investor memory."""
    result = state.get("result", {})
    result["_meta"] = {
        "data_used":  state.get("data_used", []),
        "confidence": state.get("confidence", 0.0),
        "reasoning":  state.get("reasoning", ""),
    }

    # ── Persist updated investor preferences ──────────────────────────────
    user_id = state.get("userId", "")
    if user_id:
        f = state.get("filters", {})
        save_investor_memory(
            user_id              = user_id,
            risk_appetite        = f.get("riskLevel") or None,
            preferred_industries = [f["industry"]] if f.get("industry") else None,
            preferred_stages     = [f["fundingStage"]] if f.get("fundingStage") else None,
        )

    # ── Write audit log ───────────────────────────────────────────────────
    log_agent_run(
        agent_name  = "recommendation_agent",
        user_id     = state.get("userId", ""),
        intent      = state.get("intent", "find_startups"),
        status      = state.get("status", "ok"),
        data_used   = state.get("data_used", []),
        confidence  = state.get("confidence", 0.0),
        reasoning   = state.get("reasoning", ""),
        errors      = state.get("errors", []),
    )

    return {**state, "result": result, "status": "ok"}


# ─── Error guard ─────────────────────────────────────────────────────────────

def _is_failed(state: EnigmaState) -> str:
    return "failed" if state.get("status") == "failed" else "ok"


# ─── Build Graph ─────────────────────────────────────────────────────────────

def build_recommendation_graph() -> StateGraph:
    g = StateGraph(EnigmaState)

    g.add_node("intent_parser",    intent_parser)
    g.add_node("filter_builder",   filter_builder)
    g.add_node("mongo_query",      mongo_query)
    g.add_node("ranking_engine",   ranking_engine)
    g.add_node("llm_explainer",    llm_explainer)
    g.add_node("response_formatter", response_formatter)

    g.set_entry_point("intent_parser")

    g.add_conditional_edges("intent_parser",  _is_failed,
        {"ok": "filter_builder", "failed": END})
    g.add_conditional_edges("filter_builder", _is_failed,
        {"ok": "mongo_query",    "failed": END})
    g.add_conditional_edges("mongo_query",    _is_failed,
        {"ok": "ranking_engine", "failed": END})
    g.add_edge("ranking_engine",    "llm_explainer")
    g.add_edge("llm_explainer",     "response_formatter")
    g.add_edge("response_formatter", END)

    return g.compile()


# ─── Public entry point ───────────────────────────────────────────────────────

async def run_recommendation_agent(
    user_id: str,
    user_role: str,
    raw_query: str,
) -> dict:
    graph = build_recommendation_graph()
    initial_state: EnigmaState = {
        "userId":   user_id,
        "userRole": user_role,
        "intent":   "find_startups",
        "filters":  {"raw_query": raw_query},
        "data":     {},
        "analysis": {},
        "result":   {},
        "data_used": [],
        "reasoning": "",
        "confidence": 0.0,
        "errors":   [],
        "status":   "ok",
    }
    final = await graph.ainvoke(initial_state)
    return final.get("result", {})
