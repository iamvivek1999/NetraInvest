"""
Enigma AI - Agent 3: Portfolio Monitoring Flow

Graph:
    User Query
      ↓ fetch_portfolio (tool)
      ↓ fetch_campaign_milestones (tool)
      ↓ progress_analyzer (deterministic)
      ↓ llm_summarizer (LLM)
      ↓ response_formatter
"""
import json
from datetime import datetime, timezone

from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import StateGraph, END

from enigma_ai.agents.state import EnigmaState
from enigma_ai.config import LLM_MODEL, MILESTONE_DELAY_RISK_DAYS
from enigma_ai.tools.mongo_tools import get_investor_portfolio, get_milestones


def _llm():
    return ChatGoogleGenerativeAI(model=LLM_MODEL, temperature=0.1)


# ─── NODE 1: Fetch Portfolio ──────────────────────────────────────────────────

def fetch_portfolio(state: EnigmaState) -> EnigmaState:
    user_id = state.get("filters", {}).get("userId") or state.get("userId", "")
    if not user_id:
        return {**state, "errors": ["No userId provided"], "status": "failed"}

    raw = get_investor_portfolio.invoke({"user_id": user_id})
    try:
        portfolio = json.loads(raw)
    except Exception as e:
        return {**state, "errors": [str(e)], "status": "failed"}

    return {
        **state,
        "data": {**state.get("data", {}), "portfolio": portfolio},
        "data_used": state.get("data_used", []) + ["investments", "campaigns", "startupprofiles"],
        "status": "ok",
    }


# ─── NODE 2: Fetch Campaign Milestones ───────────────────────────────────────

def fetch_campaign_milestones(state: EnigmaState) -> EnigmaState:
    portfolio = state.get("data", {}).get("portfolio", [])
    enriched  = []

    for inv in portfolio:
        campaign_id = inv.get("campaign", {}).get("_id") or inv.get("campaignId", "")
        if not campaign_id:
            enriched.append({**inv, "milestones": []})
            continue
        try:
            raw = get_milestones.invoke({"campaign_id": str(campaign_id)})
            milestones = json.loads(raw)
        except Exception:
            milestones = []
        enriched.append({**inv, "milestones": milestones})

    return {
        **state,
        "data": {**state.get("data", {}), "portfolio_enriched": enriched},
        "data_used": state.get("data_used", []) + ["milestones"],
        "status": "ok",
    }


# ─── NODE 3: Progress Analyzer (deterministic) ───────────────────────────────

def _classify_risk(
    completed: int,
    total: int,
    delayed_days: int,
) -> str:
    if delayed_days > MILESTONE_DELAY_RISK_DAYS:
        return "HIGH"
    if completed < total and completed / max(total, 1) < 0.5:
        return "MEDIUM"
    return "LOW"


def progress_analyzer(state: EnigmaState) -> EnigmaState:
    enriched   = state.get("data", {}).get("portfolio_enriched", [])
    now        = datetime.now(timezone.utc)
    details    = []
    alerts     = []
    total_invested  = 0.0
    progress_values = []

    for inv in enriched:
        amount  = float(inv.get("amount", 0) or 0)
        total_invested += amount

        milestones = inv.get("milestones", [])
        total_ms   = len(milestones)
        completed  = sum(1 for m in milestones if m.get("status") == "completed")

        # Find next pending milestone's target date
        delayed_days = 0
        for m in milestones:
            if m.get("status") not in ("completed", "approved"):
                td_raw = m.get("targetDate")
                if td_raw:
                    try:
                        td = datetime.fromisoformat(td_raw.replace("Z", "+00:00"))
                        if now > td:
                            delayed_days = (now - td).days
                    except ValueError:
                        pass
                break

        progress = (completed / total_ms) if total_ms > 0 else 0.0
        progress_values.append(progress)

        risk_level = _classify_risk(completed, total_ms, delayed_days)

        detail = {
            "startupName":          inv.get("startupName", "Unknown"),
            "industry":             inv.get("industry", ""),
            "amount":               amount,
            "currency":             inv.get("currency", "USD"),
            "investment_status":    inv.get("status", ""),
            "campaign_status":      inv.get("campaign", {}).get("status", ""),
            "milestones_total":     total_ms,
            "milestones_completed": completed,
            "progress_pct":         round(progress * 100, 1),
            "delayed_days":         delayed_days,
            "risk_level":           risk_level,
        }
        details.append(detail)

        if risk_level == "HIGH":
            alerts.append(f"⚠️  HIGH RISK: {inv.get('startupName')} is "
                          f"{delayed_days} days overdue on next milestone.")
        elif risk_level == "MEDIUM":
            alerts.append(f"⚠️  MEDIUM RISK: {inv.get('startupName')} has "
                          f"low milestone completion ({completed}/{total_ms}).")

    avg_progress = (sum(progress_values) / len(progress_values) * 100) if progress_values else 0.0
    high_risk    = [d["startupName"] for d in details if d["risk_level"] == "HIGH"]

    portfolio_summary = {
        "totalInvested":        round(total_invested, 2),
        "avgProgress":          round(avg_progress, 1),
        "totalInvestments":     len(details),
        "highRiskInvestments":  high_risk,
    }

    return {
        **state,
        "analysis": {
            "portfolio_summary": portfolio_summary,
            "details":           details,
            "alerts":            alerts,
        },
        "status": "ok",
    }


# ─── NODE 4: LLM Summarizer ──────────────────────────────────────────────────

def llm_summarizer(state: EnigmaState) -> EnigmaState:
    analysis = state.get("analysis", {})
    snapshot = json.dumps(analysis, indent=2, default=str)

    prompt = f"""You are a portfolio analyst AI for the Enigma investment platform.

Portfolio analysis data:
{snapshot}

Write a concise, professional portfolio health report.
Include:
1. Overall health assessment
2. Notable risks and which startups are affected
3. Positive signals (if any)
4. Recommended investor actions

Safety rules:
- Use ONLY the data provided above
- Do not assume missing values
- If data is insufficient → say "insufficient data"
- Output strict JSON only

Return ONLY this JSON:
{{
  "healthSummary": "<2-3 sentence overall assessment>",
  "positiveSignals": [""],
  "recommendedActions": [""],
  "confidence": 0.0,
  "reasoning": "<brief chain of thought>"
}}"""

    llm    = _llm()
    resp   = llm.invoke(prompt)
    raw    = resp.content.strip().strip("```json").strip("```").strip()

    try:
        summary = json.loads(raw)
    except json.JSONDecodeError:
        summary = {
            "healthSummary":      raw,
            "positiveSignals":    [],
            "recommendedActions": [],
            "confidence":         0.5,
            "reasoning":          "LLM parse error",
        }

    return {
        **state,
        "result": {
            "portfolioSummary": analysis.get("portfolio_summary", {}),
            "details":          analysis.get("details", []),
            "alerts":           analysis.get("alerts", []),
            "llmSummary":       summary,
        },
        "confidence": summary.get("confidence", 0.5),
        "reasoning":  summary.get("reasoning", ""),
        "status":     "ok",
    }


# ─── NODE 5: Response Formatter ──────────────────────────────────────────────

def response_formatter(state: EnigmaState) -> EnigmaState:
    result = state.get("result", {})
    result["_meta"] = {
        "data_used":  state.get("data_used", []),
        "confidence": state.get("confidence", 0.0),
        "reasoning":  state.get("reasoning", ""),
    }
    return {**state, "result": result, "status": "ok"}


def _is_failed(state: EnigmaState) -> str:
    return "failed" if state.get("status") == "failed" else "ok"


# ─── Build Graph ─────────────────────────────────────────────────────────────

def build_portfolio_graph() -> StateGraph:
    g = StateGraph(EnigmaState)

    g.add_node("fetch_portfolio",          fetch_portfolio)
    g.add_node("fetch_campaign_milestones", fetch_campaign_milestones)
    g.add_node("progress_analyzer",        progress_analyzer)
    g.add_node("llm_summarizer",           llm_summarizer)
    g.add_node("response_formatter",       response_formatter)

    g.set_entry_point("fetch_portfolio")

    g.add_conditional_edges("fetch_portfolio",          _is_failed,
        {"ok": "fetch_campaign_milestones", "failed": END})
    g.add_conditional_edges("fetch_campaign_milestones", _is_failed,
        {"ok": "progress_analyzer",        "failed": END})
    g.add_edge("progress_analyzer",  "llm_summarizer")
    g.add_edge("llm_summarizer",     "response_formatter")
    g.add_edge("response_formatter", END)

    return g.compile()


# ─── Public entry point ───────────────────────────────────────────────────────

async def run_portfolio_agent(
    user_id: str,
    user_role: str = "investor",
) -> dict:
    graph = build_portfolio_graph()
    initial_state: EnigmaState = {
        "userId":    user_id,
        "userRole":  user_role,
        "intent":    "portfolio_status",
        "filters":   {"userId": user_id},
        "data":      {},
        "analysis":  {},
        "result":    {},
        "data_used": [],
        "reasoning": "",
        "confidence": 0.0,
        "errors":    [],
        "status":    "ok",
    }
    final = await graph.ainvoke(initial_state)
    return final.get("result", {})
