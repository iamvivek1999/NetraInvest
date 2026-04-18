import json
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage
from langgraph.prebuilt import create_react_agent

from enigma_ai.config import LLM_MODEL
from enigma_ai.tools.mongo_tools import ALL_TOOLS

async def run_qa_agent(query: str) -> dict:
    """
    General QA Agent capable of using MongoDB tools to answer specific questions
    about startups, campaigns, and platform data.
    """
    llm = ChatGoogleGenerativeAI(model=LLM_MODEL, temperature=0.1)
    
    system_prompt = """You are a highly capable AI assistant for the Enigma investment platform.
You have access to database tools to answer the user's question.

IMPORTANT DATABASE SCHEMA & LINKS:
1. `startupprofiles` (Fields: _id, startupName, tagline, industry, verificationStatus, isVerified)
2. `campaigns` (Fields: _id, startupProfileId, title, fundingGoal, currentRaised, status, deadline). Linked to startupprofiles via `startupProfileId`.
3. `investments` (Fields: _id, campaignId, startupProfileId, investorUserId, amount, status). Linked to campaigns via `campaignId`.
4. `milestones` (Fields: _id, campaignId, startupProfileId, status, percentage, proofSubmission). Linked to campaigns via `campaignId`.
5. `investorprofile` (Fields: _id, userId, firstName, lastName, verificationStatus).

HOW TO FIND DATA:
- ALWAYS prioritize using `find_documents(collection, query)` for answering questions.
- Example: "how much is Startup Five demanding?" 
  -> Step 1: `find_documents('startupprofiles', {"startupName": {"$regex": "Startup Five", "$options": "i"}})` to get the `_id`.
  -> Step 2: `find_documents('campaigns', {"startupProfileId": "<_id from Step 1>"})` to get the `fundingGoal`.
- Example: "which startups are verified?"
  -> `find_documents('startupprofiles', {"verificationStatus": "approved"})` or `{"isVerified": true}`.
- If asked about categories, you can use `get_startup_categories()`.

Navigate the data using these tools and provide a concise, factual answer.
"""
    
    agent = create_react_agent(llm, tools=ALL_TOOLS, prompt=system_prompt)
    
    response = await agent.ainvoke({"messages": [
        HumanMessage(content=query)
    ]})
    
    final_message = response["messages"][-1].content
    
    return {
        "status": "ok",
        "answer": final_message,
        "qa_query": query
    }
