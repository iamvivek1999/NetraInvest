"""
Enigma AI - Main Orchestrator

Routes user intent to the correct agent:
  "find_startups"      → Recommendation Agent
  "portfolio_status"   → Portfolio Monitoring Agent
  "evaluate_milestone" → Milestone Evaluation Agent (HITL)
"""
import json
from langchain_google_genai import ChatGoogleGenerativeAI

from enigma_ai.config import LLM_MODEL
from enigma_ai.agents.recommendation_agent import run_recommendation_agent
from enigma_ai.agents.portfolio_agent import run_portfolio_agent
from enigma_ai.agents.milestone_agent import run_milestone_agent
from enigma_ai.agents.qa_agent import run_qa_agent
from enigma_ai.tools.mongo_tools import get_startup_categories, get_user_id_by_name

def _extract_name_from_query(query: str) -> str:
    """Uses a quick LLM call to extract a person's name from a query"""
    prompt = f"Extract the person's name from this query if present. If no name is mentioned, return exactly 'NONE'.\nQuery: \"{query}\""
    llm = ChatGoogleGenerativeAI(model=LLM_MODEL, temperature=0.0)
    res = llm.invoke(prompt).content.strip()
    return res if res.upper() != 'NONE' else ""


def _detect_intent(query: str) -> str:
    """Uses LLM to robustly classify the user's intent."""
    prompt = f"""Classify the user's intent into EXACTLY ONE of the following categories:
    - "portfolio_status": Asking about their own portfolio, investments, or how their investments are doing.
    - "evaluate_milestone": Approving, reviewing, or evaluating a startup's milestone/proof of work.
    - "find_startups": Asking for recommendations, matching, or lists of startups to invest in.
    - "general_qa": Asking general questions about the platform, statistics (how many startups are verified), available categories, or a specific question about a specific startup.
    
    Query: "{query}"
    
    Return EXACTLY the category name, nothing else.
    """
    llm = ChatGoogleGenerativeAI(model=LLM_MODEL, temperature=0.0)
    res = llm.invoke(prompt).content.strip()
    return res if res in ("portfolio_status", "evaluate_milestone", "general_qa", "find_startups") else "find_startups"


async def run_orchestrator(
    query:           str,
    user_id:         str,
    user_role:       str = "investor",
    campaign_id:     str = "",
    milestone_index: int | None = None,
) -> dict:
    """
    Main entry point. Detects intent and dispatches to the right agent.
    """
    intent = _detect_intent(query)
    print(f"\n[Orchestrator] Detected intent: {intent}")

    if intent == "find_startups":
        return await run_recommendation_agent(user_id, user_role, query)

    elif intent == "general_qa":
        return await run_qa_agent(query)

    elif intent == "portfolio_status":
        if not user_id:
            name = _extract_name_from_query(query)
            if name:
                user_id = get_user_id_by_name(name)
                if not user_id:
                    return {"status": "failed", "error": f"I could not find an investor account matching the name '{name}'."}
            else:
                return {
                    "status": "requires_input",
                    "message": "I can certainly look up your portfolio! Could you please provide your full name or investor ID?"
                }
        return await run_portfolio_agent(user_id, user_role)

    elif intent == "evaluate_milestone":
        if not campaign_id:
            return {"error": "campaignId is required for milestone evaluation", "status": "failed"}
        return await run_milestone_agent(campaign_id, milestone_index, user_id, user_role)

    return {"error": f"Unknown intent: {intent}", "status": "failed"}
