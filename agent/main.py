"""
Enigma AI - Main Entry Point

Runs all three agents end-to-end to validate the full system.
Adjust the test parameters below to match real IDs from your MongoDB.
"""
import asyncio
import json
from enigma_ai.orchestrator import run_orchestrator


# ─── Test configuration ───────────────────────────────────────────────────────
# Replace with real ObjectId strings from your test DB

# A real investor userId from test.users (role: investor or admin)
TEST_INVESTOR_ID = "69e344fa242e2ab8e24ebb52"

# A real campaignId from test.campaigns
TEST_CAMPAIGN_ID = "69e344fe242e2ab8e24ebb66"

# Optional: specific milestone index (0-based). None = first pending.
TEST_MILESTONE_INDEX = None


def _pp(label: str, data: dict):
    print(f"\n{'='*60}")
    print(f"  {label}")
    print('='*60)
    # Strip _meta for cleaner display
    clean = {k: v for k, v in data.items() if k != "_meta"}
    print(json.dumps(clean, indent=2, default=str))
    if "_meta" in data:
        print("\n[Explainability]")
        print(json.dumps(data["_meta"], indent=2, default=str))


async def main():
    print("\n🚀  Enigma AI Multi-Agent System — Test Run\n")

    # ── Agent 1: Recommendation ───────────────────────────────────────────────
    print("▶  Running Agent 1: Recommendation Agent...")
    rec_result = await run_orchestrator(
        query    = "Show me fintech startups in the seed stage with low risk",
        user_id  = TEST_INVESTOR_ID,
        user_role= "investor",
    )
    _pp("AGENT 1 — STARTUP RECOMMENDATIONS", rec_result)

    # ── Agent 3: Portfolio ────────────────────────────────────────────────────
    print("\n▶  Running Agent 3: Portfolio Monitoring Agent...")
    port_result = await run_orchestrator(
        query    = "Show me my portfolio status",
        user_id  = TEST_INVESTOR_ID,
        user_role= "investor",
    )
    _pp("AGENT 3 — PORTFOLIO MONITORING", port_result)

    # ── Agent 2: Milestone Evaluation (HITL) ──────────────────────────────────
    if TEST_CAMPAIGN_ID != "":
        print("\n▶  Running Agent 2: Milestone Evaluation Agent (HITL)...")
        ms_result = await run_orchestrator(
            query          = "Evaluate the milestone proof submission",
            user_id        = TEST_INVESTOR_ID,
            user_role      = "admin",
            campaign_id    = TEST_CAMPAIGN_ID,
            milestone_index= TEST_MILESTONE_INDEX,
        )
        _pp("AGENT 2 — MILESTONE EVALUATION (PENDING HUMAN)", ms_result)
    else:
        print("\n⚠  Skipping Milestone Agent — set TEST_CAMPAIGN_ID in main.py")

    print("\n✅  All agents completed successfully.\n")


if __name__ == "__main__":
    asyncio.run(main())
