"""
Enigma AI - Unified Chat API Routes
POST /api/chat
"""
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
import json
from langchain_google_genai import ChatGoogleGenerativeAI

from enigma_ai.orchestrator import run_orchestrator
from enigma_ai.config import LLM_MODEL

router = APIRouter(prefix="/api/chat", tags=["Chat"])

class ChatRequest(BaseModel):
    query: str
    user_id: str = Field("", description="Logged-in user's MongoDB ObjectId — passed from frontend auth store")
    user_role: str = Field("investor", description="'investor' | 'admin'")
    campaign_id: str = Field("")
    milestone_index: int | None = Field(None)


@router.post("", summary="Chat with the Enigma AI orchestrator")
async def chat(body: ChatRequest):
    try:
        result = await run_orchestrator(
            query=body.query,
            user_id=body.user_id,
            user_role=body.user_role,
            campaign_id=body.campaign_id,
            milestone_index=body.milestone_index,
        )
        
        # ── Convert structured result to conversational text ─────────────
        prompt = f"""You are the Enigma AI Investment Assistant.
The user asked: "{body.query}"

Here is the structured data returned by the system's agents:
{json.dumps(result, indent=2)}

Please provide a friendly, natural language response to the user's question based ONLY on this structured data.
Keep it concise, helpful, and professional. 
Use markdown formatting (bolding, lists) to make it readable.
Do NOT output raw JSON. If the user asks a question, answer it directly using the data provided.
"""
        llm = ChatGoogleGenerativeAI(model=LLM_MODEL, temperature=0.4)
        response = llm.invoke(prompt)

        return JSONResponse(content={
            "text": response.content,
            "data": result
        })
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e), "status": "failed"})
