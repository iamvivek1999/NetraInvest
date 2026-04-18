"""
Enigma AI - Agent 2: Milestone Evaluation Flow (HITL)

Graph:
    Proof Submission
      ↓ fetch_milestone_data (tool)
      ↓ pre_validator (deterministic rules, immediate reject)
      ↓ ai_evaluator (LLM)
      ↓ risk_analyzer (hybrid deterministic + LLM)
      ↓ report_generator (LLM)
      ↓ hitl_gate (PAUSE → awaits admin action)

NON-NEGOTIABLE: milestones are NEVER auto-approved.
"""
import json
from datetime import datetime, timezone
from typing import Literal

from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import StateGraph, END

from enigma_ai.agents.state import EnigmaState
from enigma_ai.config import LLM_MODEL, MILESTONE_DELAY_RISK_DAYS
from enigma_ai.tools.mongo_tools import get_milestones, get_campaign_details
from enigma_ai.audit import log_ai_decision, log_agent_run
from enigma_ai.hitl_store import save_pending_review


def _llm():
    return ChatGoogleGenerativeAI(model=LLM_MODEL, temperature=0.1)


# ─── NODE 1: Fetch Milestone Data ─────────────────────────────────────────────

def fetch_milestone_data(state: EnigmaState) -> EnigmaState:
    campaign_id    = state.get("filters", {}).get("campaignId", "")
    milestone_index = state.get("filters", {}).get("milestoneIndex")

    if not campaign_id:
        return {**state, "errors": ["campaignId is required"], "status": "failed"}

    try:
        milestones_raw = get_milestones.invoke({"campaign_id": campaign_id})
        campaign_raw   = get_campaign_details.invoke({"campaign_id": campaign_id})
        milestones = json.loads(milestones_raw)
        campaign   = json.loads(campaign_raw)
    except Exception as e:
        return {**state, "errors": [str(e)], "status": "failed"}

    # Find the target milestone
    target_ms = None
    if milestone_index is not None:
        target_ms = next((m for m in milestones if m.get("index") == int(milestone_index)), None)
    else:
        # Default: first pending milestone
        target_ms = next((m for m in milestones
                          if m.get("status") not in ("completed", "approved", "rejected")), None)

    if not target_ms:
        return {**state,
                "errors": [f"No pending milestone found for campaign {campaign_id}"],
                "status": "failed"}

    return {
        **state,
        "data": {
            **state.get("data", {}),
            "milestone":  target_ms,
            "campaign":   campaign,
            "all_milestones": milestones,
        },
        "data_used": state.get("data_used", []) + ["milestones", "campaigns"],
        "status": "ok",
    }


# ─── NODE 2: Pre-Validator (deterministic rules) ─────────────────────────────

def pre_validator(state: EnigmaState) -> EnigmaState:
    """Hard reject rules — no LLM involved."""
    milestone = state.get("data", {}).get("milestone", {})
    errors = []

    proof = milestone.get("proofSubmission")
    if not proof:
        errors.append("No proof submitted.")
    elif isinstance(proof, dict):
        if not proof.get("url") and not proof.get("description"):
            errors.append("Proof is missing both URL and description.")

    title = milestone.get("title", "")
    if not title:
        errors.append("Milestone has no title.")

    if errors:
        return {
            **state,
            "analysis": {
                **state.get("analysis", {}),
                "pre_validation": {"passed": False, "rejection_reasons": errors},
            },
            "result": {
                "milestone":         milestone.get("title", ""),
                "completion_status": "Rejected",
                "confidence":        1.0,
                "risks":             [],
                "redFlags":          errors,
                "recommendation":    "reject",
                "explanation":       "Automatic rejection: " + "; ".join(errors),
            },
            "status": "pre_validation_failed",
        }

    return {
        **state,
        "analysis": {
            **state.get("analysis", {}),
            "pre_validation": {"passed": True, "rejection_reasons": []},
        },
        "status": "ok",
    }


# ─── NODE 3: AI Evaluator (LLM) ──────────────────────────────────────────────

def ai_evaluator(state: EnigmaState) -> EnigmaState:
    milestone = state.get("data", {}).get("milestone", {})
    campaign  = state.get("data", {}).get("campaign", {})

    proof_summary = json.dumps(milestone.get("proofSubmission", {}), default=str)

    prompt = f"""You are a milestone evaluator for the Enigma investment platform.

Evaluate whether this milestone has been completed based on the evidence provided.

Milestone details:
- Title: {milestone.get('title', '')}
- Description: {milestone.get('description', '')}
- Estimated Amount: {milestone.get('estimatedAmount', 'N/A')}
- Target Date: {milestone.get('targetDate', 'N/A')}
- Expected Completion %: {milestone.get('percentage', 'N/A')}%

Proof submitted:
{proof_summary}

Campaign context:
- Total funding goal: {campaign.get('fundingGoal', 'N/A')}
- Current raised: {campaign.get('currentRaised', 'N/A')}

Safety rules:
- Use ONLY the data provided above
- Do not assume or invent missing values
- If unsure → say "insufficient data"
- Output strict JSON only

Return ONLY this JSON:
{{
  "completion_status": "Completed | Partial | Not Completed",
  "confidence_score": 0.0,
  "key_observations": [""],
  "missing_evidence": [""],
  "reasoning": ""
}}"""

    llm  = _llm()
    resp = llm.invoke(prompt)
    raw  = resp.content.strip().strip("```json").strip("```").strip()

    try:
        evaluation = json.loads(raw)
    except json.JSONDecodeError:
        evaluation = {
            "completion_status": "Not Completed",
            "confidence_score":  0.3,
            "key_observations":  ["LLM parse error"],
            "missing_evidence":  ["LLM parse error — manual review required"],
            "reasoning":         raw,
        }

    return {
        **state,
        "analysis": {**state.get("analysis", {}), "ai_evaluation": evaluation},
        "status": "ok",
    }


# ─── NODE 4: Risk Analyzer (hybrid) ──────────────────────────────────────────

def risk_analyzer(state: EnigmaState) -> EnigmaState:
    milestone    = state.get("data", {}).get("milestone", {})
    ai_eval      = state.get("analysis", {}).get("ai_evaluation", {})
    now          = datetime.now(timezone.utc)
    risks        = []
    risk_score   = 0  # accumulator

    # Rule 1: Delay
    td_raw = milestone.get("targetDate")
    delayed_days = 0
    if td_raw:
        try:
            td = datetime.fromisoformat(td_raw.replace("Z", "+00:00"))
            if now > td:
                delayed_days = (now - td).days
                risk_score += 1
                risks.append(f"Overdue by {delayed_days} days.")
        except ValueError:
            pass

    # Rule 2: No verifiable links in proof
    proof = milestone.get("proofSubmission", {})
    if isinstance(proof, dict) and not proof.get("url"):
        risk_score += 1
        risks.append("No verifiable URL/link in proof submission.")

    # Rule 3: LLM flagged low confidence
    if ai_eval.get("confidence_score", 1.0) < 0.5:
        risk_score += 1
        risks.append(f"Low AI confidence score: {ai_eval.get('confidence_score')}")

    # Rule 4: Missing evidence flagged by LLM
    if ai_eval.get("missing_evidence"):
        risk_score += 1
        risks.append("Missing evidence identified by AI evaluation.")

    # Rule 5: Not completed status
    if ai_eval.get("completion_status") == "Not Completed":
        risk_score += 2

    if risk_score >= 4:
        risk_level = "HIGH"
    elif risk_score >= 2:
        risk_level = "MEDIUM"
    else:
        risk_level = "LOW"

    return {
        **state,
        "analysis": {
            **state.get("analysis", {}),
            "risk_analysis": {
                "risk_level":   risk_level,
                "risk_score":   risk_score,
                "risks":        risks,
                "delayed_days": delayed_days,
            },
        },
        "status": "ok",
    }


# ─── NODE 5: Report Generator (LLM) ──────────────────────────────────────────

def report_generator(state: EnigmaState) -> EnigmaState:
    milestone  = state.get("data", {}).get("milestone", {})
    ai_eval    = state.get("analysis", {}).get("ai_evaluation", {})
    risk       = state.get("analysis", {}).get("risk_analysis", {})
    pre_val    = state.get("analysis", {}).get("pre_validation", {})

    snapshot = {
        "milestone_title":   milestone.get("title"),
        "ai_evaluation":     ai_eval,
        "risk_analysis":     risk,
        "pre_validation":    pre_val,
    }

    prompt = f"""You are a milestone evaluation report generator for the Enigma platform.

Generate a final evaluation report for an admin to review.
Data:
{json.dumps(snapshot, indent=2, default=str)}

Safety rules:
- Use ONLY the data provided
- Do not assume or invent missing values
- Never auto-approve; always route to human review
- Output strict JSON only

Return ONLY this JSON:
{{
  "milestone": "<title>",
  "completion_status": "Completed | Partial | Not Completed",
  "confidence": 0.0,
  "risks": [""],
  "redFlags": [""],
  "recommendation": "approve | reject | review",
  "explanation": "<detailed explanation for admin>",
  "reasoning": "<chain of thought>"
}}

IMPORTANT: Only set recommendation to 'approve' if completion_status is 'Completed'
AND confidence > 0.8 AND risk_level is 'LOW'. Otherwise use 'review' or 'reject'."""

    llm  = _llm()
    resp = llm.invoke(prompt)
    raw  = resp.content.strip().strip("```json").strip("```").strip()

    try:
        report = json.loads(raw)
    except json.JSONDecodeError:
        report = {
            "milestone":         milestone.get("title", ""),
            "completion_status": ai_eval.get("completion_status", "Not Completed"),
            "confidence":        ai_eval.get("confidence_score", 0.3),
            "risks":             risk.get("risks", []),
            "redFlags":          ai_eval.get("missing_evidence", []),
            "recommendation":    "review",
            "explanation":       raw,
            "reasoning":         "LLM parse error — manual review required",
        }

    # ENFORCE: never auto-approve if risk is HIGH
    if risk.get("risk_level") == "HIGH" and report.get("recommendation") == "approve":
        report["recommendation"] = "review"
        report["explanation"] += " [Auto-promotion to 'review' due to HIGH risk level.]"

    # ── Write AI decision to audit log ─────────────────────────────────────
    campaign_id     = state.get("filters", {}).get("campaignId", "")
    milestone_index = state.get("filters", {}).get("milestoneIndex")
    ai_audit_id     = log_ai_decision(
        agent_name       = "milestone_agent",
        user_id          = state.get("userId", ""),
        campaign_id      = campaign_id,
        milestone_index  = milestone_index,
        recommendation   = report.get("recommendation", "review"),
        confidence       = report.get("confidence", 0.5),
        reasoning        = report.get("reasoning", ""),
        report_snapshot  = report,
    )

    return {
        **state,
        "result":     report,
        "confidence": report.get("confidence", 0.5),
        "reasoning":  report.get("reasoning", ""),
        "status":     "ok",
        "analysis":   {**state.get("analysis", {}), "_ai_audit_id": ai_audit_id},
    }


# ─── NODE 6: HITL Gate ───────────────────────────────────────────────────────

def hitl_gate(state: EnigmaState) -> EnigmaState:
    """
    Pauses and persists state to MongoDB (hitl_pending collection).
    Admin resolves via resolve_hitl() in hitl_store.py.
    NON-NEGOTIABLE: milestones are NEVER auto-approved here.
    """
    result   = state.get("result", {})
    campaign_id     = state.get("filters", {}).get("campaignId", "")
    milestone_index = state.get("filters", {}).get("milestoneIndex")
    ai_audit_id     = state.get("analysis", {}).get("_ai_audit_id", "")

    # ── Persist to MongoDB for async admin review ─────────────────────────
    hitl_id = save_pending_review(
        campaign_id     = campaign_id,
        milestone_index = milestone_index,
        report          = result,
        ai_audit_log_id = ai_audit_id,
    )

    # ── Write agent run audit entry ─────────────────────────────────────
    log_agent_run(
        agent_name  = "milestone_agent",
        user_id     = state.get("userId", ""),
        intent      = "evaluate_milestone",
        status      = "pending_human",
        data_used   = state.get("data_used", []),
        confidence  = state.get("confidence", 0.0),
        reasoning   = state.get("reasoning", ""),
        errors      = state.get("errors", []),
    )

    result["_meta"] = {
        "data_used":      state.get("data_used", []),
        "confidence":     state.get("confidence", 0.0),
        "reasoning":      state.get("reasoning", ""),
        "hitl_required":  True,
        "hitl_id":        hitl_id,
        "admin_options":  ["approve", "reject", "request_more_info"],
        "note":           "Awaiting admin review. AI recommendation is advisory only.",
    }
    return {**state, "result": result, "status": "pending_human"}


def apply_hitl_decision(
    state: EnigmaState,
    admin_decision: Literal["approve", "reject", "request_more_info"],
    admin_notes: str = "",
) -> EnigmaState:
    """
    Called externally after admin reviews the report.
    Updates state with final human decision.
    This is the ONLY way a milestone advances to 'approved'.
    """
    result = state.get("result", {})
    result["adminDecision"] = admin_decision
    result["adminNotes"]    = admin_notes
    result["decidedAt"]     = datetime.now(timezone.utc).isoformat()
    return {**state, "result": result, "status": f"admin_{admin_decision}"}


# ─── Routing ──────────────────────────────────────────────────────────────────

def _route_after_pre_validation(state: EnigmaState) -> str:
    status = state.get("status", "ok")
    if status == "pre_validation_failed":
        return "skip_to_hitl"  # still needs admin to formally reject
    if status == "failed":
        return "failed"
    return "ok"


def _is_failed(state: EnigmaState) -> str:
    return "failed" if state.get("status") == "failed" else "ok"


# ─── Build Graph ─────────────────────────────────────────────────────────────

def build_milestone_graph() -> StateGraph:
    g = StateGraph(EnigmaState)

    g.add_node("fetch_milestone_data", fetch_milestone_data)
    g.add_node("pre_validator",        pre_validator)
    g.add_node("ai_evaluator",         ai_evaluator)
    g.add_node("risk_analyzer",        risk_analyzer)
    g.add_node("report_generator",     report_generator)
    g.add_node("hitl_gate",            hitl_gate)

    g.set_entry_point("fetch_milestone_data")

    g.add_conditional_edges("fetch_milestone_data", _is_failed,
        {"ok": "pre_validator", "failed": END})

    g.add_conditional_edges("pre_validator", _route_after_pre_validation, {
        "ok":           "ai_evaluator",
        "skip_to_hitl": "hitl_gate",   # pre-rejected, still route to admin
        "failed":        END,
    })

    g.add_edge("ai_evaluator",     "risk_analyzer")
    g.add_edge("risk_analyzer",    "report_generator")
    g.add_edge("report_generator", "hitl_gate")
    g.add_edge("hitl_gate",        END)

    return g.compile()


# ─── Public entry point ───────────────────────────────────────────────────────

async def run_milestone_agent(
    campaign_id: str,
    milestone_index: int | None = None,
    user_id: str = "",
    user_role: str = "admin",
) -> dict:
    graph = build_milestone_graph()
    initial_state: EnigmaState = {
        "userId":   user_id,
        "userRole": user_role,
        "intent":   "evaluate_milestone",
        "filters":  {
            "campaignId":     campaign_id,
            "milestoneIndex": milestone_index,
        },
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
