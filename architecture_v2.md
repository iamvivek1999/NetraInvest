# Refined Architecture — Hackathon MVP
## Version 2 — Updated for Constraints

> Changes from v1 are clearly marked with ⚡ CHANGED and ✅ KEPT or ❌ REMOVED

---

## Summary of Changes

| Area | V1 Approach | V2 Revised Approach |
|---|---|---|
| Smart contract | One contract per campaign | ⚡ One global contract, all campaigns inside |
| Transaction recording | Alchemy WebSocket (primary) | ⚡ Frontend posts txHash immediately (primary) |
| Event listener | Core dependency | ⚡ Optional enhancement only |
| Admin | Separate role with UI | ⚡ Backend-only via protected API |
| Reconciliation | Planned | ❌ Removed |
| Circuit breaker | Planned | ❌ Removed |
| Production scaling | Mentioned | ❌ Out of scope |

---

## 1. Smart Contract Design — Revised

### V1 Problem
Deploying one Solidity contract per campaign means:
- ~$0.01 gas per deploy on Polygon (acceptable), but
- Backend must track dozens of contract addresses
- ABI wiring repeated for each contract
- Testing complexity multiplies with every campaign
- Frontend needs the right ABI + address per campaign call

### V2 Solution: Single Global Contract

**One `InvestmentPlatform.sol` deployed once. All campaigns live inside it.**

```
Contract: InvestmentPlatform.sol (deployed once to Polygon Mumbai)
          │
          ├── campaigns[campaignId] → CampaignData struct
          │       │
          │       ├── startupWallet
          │       ├── fundingGoal
          │       ├── totalRaised
          │       ├── milestoneCount
          │       ├── milestonePcts[]
          │       ├── currentMilestoneIndex
          │       ├── status (Active / Funded / Closed)
          │       └── investors[address] → amount invested
          │
          ├── invest(campaignId) payable
          ├── releaseMilestone(campaignId, milestoneIndex)
          ├── refund(campaignId)
          └── Events: Invested, MilestoneReleased, Refunded
```

### How Campaigns Are Identified Inside the Contract

**campaignId = MongoDB ObjectId string (bytes32 encoded)**

```
Flow:
1. Startup creates campaign in MongoDB → gets ObjectId (e.g. "664abc123...")
2. Backend calls contract.createCampaign(campaignId, startupWallet, goal, pcts[])
3. Contract stores: campaigns[campaignId] → CampaignData
4. All future interactions reference same campaignId

Result:
- MongoDB _id and contract key are the same value
- No address mapping needed
- Backend only needs ONE contract address + ONE ABI
- Frontend only needs ONE contract address + ONE ABI
```

### Contract Data Structure (Conceptual)

```
mapping(bytes32 => Campaign) public campaigns;
mapping(bytes32 => mapping(address => uint256)) public investments;

struct Campaign {
  address payable startupWallet;
  uint256 fundingGoal;
  uint256 totalRaised;
  uint256[] milestonePcts;       // e.g. [30, 40, 30]
  uint256 currentMilestoneIndex;
  CampaignStatus status;         // Active, Funded, Closed
}
```

### Admin Authorization in Contract

```
Only ONE admin address can:
  - createCampaign()
  - releaseMilestone()

Set at deploy time:
  constructor(address _admin) { admin = _admin; }

This admin address = backend wallet address (stored in .env)
```

### Why This Is Better for Hackathon

```
✅ One deploy, done — no repeated deploy scripts
✅ One ABI file used everywhere (frontend + backend)
✅ One contract address in .env
✅ campaignId is the same in MongoDB and on-chain — no sync needed
✅ Simpler frontend: ethers.connect(CONTRACT_ADDRESS, ABI)
✅ Simpler backend: one contract instance for all operations
✅ Easier Hardhat testing: single contract test suite
```

---

## 2. Event Handling — Revised

### V1 Problem
Depending on Alchemy WebSocket as the **primary** recording mechanism means:
- Backend must maintain a live WebSocket connection that can drop
- If listener misses an event → investment not recorded → investor's dashboard wrong
- Complex reconnection logic needed for reliability
- Adds 2+ hours of setup and debugging for MVP

### V2 Solution: Frontend-First Transaction Recording

**Primary path: Frontend posts the txHash immediately after MetaMask confirms.**

```
REVISED INVESTMENT RECORDING FLOW:

Step 1: Investor clicks Invest
Step 2: MetaMask popup → investor signs
Step 3: ethers.js waits for tx confirmation (await tx.wait())
Step 4: Frontend receives confirmed txHash + receipt
Step 5: Frontend immediately calls:
        POST /api/investments
        { campaignId, amount, txHash, investorWallet }
Step 6: Backend writes Investment to MongoDB
        { txHash, amount, campaignId, investorId, status: "confirmed" }
Step 7: Backend updates campaign.currentRaised += amount
Step 8: Frontend shows success UI + Polygonscan link

Done. No WebSocket needed.
```

### Why This is Safe Enough for MVP

```
Q: What if the frontend crashes after tx but before POST?
A: Investor lost a record, not money. Contract holds funds.
   Edge case. For demo: this never happens deliberately.
   For production: add retry logic and WebSocket backup.

Q: Can an investor fake a txHash?
A: YES — mitigated by:
   - Backend calls ethers.provider.getTransaction(txHash) to verify it exists
   - Verify tx.to === CONTRACT_ADDRESS
   - Verify tx.value === submitted amount (±tolerance)
   - This is a 5-line check, not full WebSocket infrastructure
```

### Transaction Verification (Lightweight)

```
On POST /api/investments, backend does:

  const tx = await provider.getTransaction(txHash)
  
  Verify:
  - tx exists (not null)
  - tx.to === CONTRACT_ADDRESS
  - tx.from === investorWallet
  - tx confirmed (tx.blockNumber is not null)

  If valid → write to MongoDB
  If invalid → reject with 400
```

### Alchemy WebSocket — Optional Enhancement Only

```
If time permits (Phase 6, after demo flow works):
  - Set up Alchemy webhook for Invested event
  - Use it as a BACKUP to catch any missed frontend posts
  - Upsert by txHash (safe — idempotent)

If time does NOT permit:
  - Frontend-first recording is sufficient for demo
  - Dashboard will be accurate for all normal flows
```

### Revised Event Strategy Summary

```
Contract Events:     Emitted on-chain (always — free, automatic)
Primary Recording:   Frontend POST after tx.wait() confirmation
Verification:        Backend lightweight getTransaction() check
Backup (optional):   Alchemy WebSocket listener (Phase 6)
On-chain truth:      contract.campaigns[id].totalRaised (read anytime, free)
```

---

## 3. Admin Role — Revised

### V1 Problem
Admin role implied a UI panel, user login flow, and role management overhead.

### V2 Solution: Backend-Only Admin

**Admin = a protected API route authenticated by a hardcoded secret.**

```
Admin Architecture:

APPROACH:
  Admin does not have a separate UI.
  Admin actions are triggered via:
  - Postman (during development and demo)
  - A simple curl command
  - Can be shown live in a demo as a "backend operation"

AUTH MECHANISM:
  Admin routes protected by: x-admin-key: <ADMIN_SECRET> header
  ADMIN_SECRET stored in backend .env
  Never exposed to frontend

  OR alternatively:
  Admin user in MongoDB with role: "admin"
  Admin JWT issued normally via /api/auth/login
  Admin routes check req.user.role === "admin"
  (Cleaner — use this approach)
```

### Admin-Only Routes (MVP)

```
POST   /api/admin/campaigns/:campaignId/milestones/:milestoneId/approve
         → sets milestone.status = "approved"
         → calls contract.releaseMilestone(campaignId, milestoneIndex)
         → records txHash in MongoDB
         → updates campaign.currentReleased

POST   /api/admin/startups/:startupId/verify
         → sets startup_profile.isVerified = true

DELETE /api/admin/campaigns/:campaignId
         → cancels a campaign (status = "cancelled")
```

### Milestone Approval Flow — Revised

```
BEFORE (V1):
  Startup submits proof →
  Admin UI reviews →
  Admin clicks approve in UI →
  Backend releases funds

AFTER (V2):
  Startup submits proof (via dashboard form)
       ↓
  Milestone status = "submitted" in MongoDB
       ↓
  [Demo moment] Open Postman / call admin API
  POST /api/admin/milestones/:id/approve
  Header: Authorization: Bearer <admin_jwt>
       ↓
  Backend:
    1. Validates milestone is in "submitted" state
    2. Calls contract.releaseMilestone(campaignId, index)
    3. Waits for tx confirmation
    4. Gets txHash from receipt
    5. Updates milestone: status = "released", releaseTxHash = txHash
    6. Updates campaign.currentReleased += amount
       ↓
  Startup dashboard updates
  Investor dashboard updates
  Polygonscan link appears in both dashboards

Result: Clean demo. No admin UI needed. Works perfectly in a demo context.
```

### Why Postman-Based Admin is Fine for Hackathon

```
✅ Hackathon judges understand backend-only admin flows
✅ "Showing the API call being made" can be part of the demo narrative
✅ Saves 1–2 days of building an admin UI
✅ Admin logic is the same regardless of UI
✅ Can narrate it: "In production, this would be an admin dashboard with DAO voting"
```

---

## 4. Complexity Removed

### ❌ Reconciliation Scripts
**Removed because**: Frontend-first recording makes MongoDB accurate by default.  
The only gap (frontend crash after tx) is an edge case that won't appear in a demo.  
**Long-term note**: Re-add this post-hackathon as a cron job.

### ❌ Circuit Breaker Logic
**Removed because**: All financial operations happen on Polygon Mumbai testnet.  
No real money at stake. If something breaks, redeploy.  
**Long-term note**: Add OpenZeppelin `Pausable` to the contract before mainnet.

### ❌ Production Scaling Concerns
**Removed because**: Platform will have < 10 concurrent users during a hackathon demo.  
No need for load balancing, connection pooling optimization, or rate limiting.  
**Long-term note**: Add Helmet.js, rate limiting, and connection pooling for production.

### ❌ Refund Flow UI
**Removed because**: Refund function exists in the contract — testable via Hardhat.  
UI for investor to trigger refund is deferred.  
**Long-term note**: Add a "Request Refund" button on investor dashboard for failed campaigns.

### ❌ IPFS for Documents
**Removed because**: For demo, pitch deck = URL field. IPFS adds complexity with no demo value.  
**Long-term note**: Swap URL fields for IPFS CIDs and use Pinata or Web3.Storage.

---

## 5. Updated Architecture Diagram

```
┌────────────────────────────────────────────────────────────┐
│                    CLIENT (Next.js)                        │
│                                                            │
│  Pages: Landing, Browse, Campaign Detail, Dashboards       │
│  Auth: JWT in localStorage                                 │
│  Web3: ethers.js + MetaMask                                │
│  API: Axios → Express backend                              │
└──────────────────────┬─────────────────────────────────────┘
                       │ HTTPS REST
┌──────────────────────▼─────────────────────────────────────┐
│                 BACKEND (Express)                          │
│                                                            │
│  Auth routes (JWT, roles: investor / startup / admin)      │
│  Startup + Campaign routes                                 │
│  Investment routes (verify txHash, record to MongoDB)      │
│  Milestone routes (submit proof, admin approve + release)  │
│  Dashboard routes (aggregate queries)                      │
│  Credibility score service (heuristic, computed on create) │
│                                                            │
│  Contract Service:                                         │
│    createCampaign()    → one-time contract interaction     │
│    releaseMilestone()  → admin-triggered only              │
│    getBalance()        → read-only, no gas                 │
│    verifyTx()          → provider.getTransaction()         │
└───────────┬──────────────────────────┬─────────────────────┘
            │                          │
┌───────────▼──────────┐   ┌───────────▼────────────────────┐
│   MongoDB Atlas      │   │   InvestmentPlatform.sol        │
│                      │   │   (ONE contract, Polygon Mumbai) │
│  users               │   │                                  │
│  startup_profiles    │   │  campaigns[campaignId] → struct  │
│  campaigns           │   │  investments[id][addr] → amount  │
│  milestones          │   │  invest(campaignId) payable      │
│  investments         │   │  releaseMilestone(id, index)     │
│  blockchain_txs      │   │  refund(campaignId)              │
│  credibility_scores  │   │  Events: Invested, Released      │
│  progress_updates    │   └──────────────────────────────────┘
└──────────────────────┘
```

---

## 6. Revised Implementation Order

### Phase 1: Foundation (Day 1)
```
1.  Monorepo scaffold: frontend/ backend/ blockchain/
2.  Backend: Express + MongoDB + env setup
3.  Backend: User model + JWT auth (register, login)
4.  Backend: Role middleware (investor, startup, admin)
5.  Backend: Startup profile model + CRUD

Checkpoint: Auth works, startup profile created, roles enforced
```

### Phase 2: Smart Contract (Day 1–2)
```
6.  Hardhat setup inside blockchain/
7.  InvestmentPlatform.sol:
      createCampaign, invest, releaseMilestone, refund, events
8.  Hardhat tests (invest + release flow)
9.  Deploy to Polygon Mumbai → save CONTRACT_ADDRESS to .env
10. Backend: Contract service (createCampaign, releaseMilestone, verifyTx)

Checkpoint: Contract on testnet. invest() and releaseMilestone() work in tests.
```

### Phase 3: Campaign + Investment Flow (Day 2–3)
```
11. Backend: Campaign model + create route
      → calls createCampaign() on contract
      → stores MongoDB campaignId = on-chain key
12. Backend: Milestone model + create route
13. Backend: POST /api/investments
      → verifyTx() check
      → write to MongoDB
      → update campaign.currentRaised
14. Frontend: Wallet connect (MetaMask)
15. Frontend: Campaign detail page + Invest button
16. Frontend: tx.wait() → POST investment → show txHash

Checkpoint: Full investment flow. Money in contract. MongoDB updated. txHash visible.
```

### Phase 4: Milestone System (Day 3–4)
```
17. Backend: PATCH /api/milestones/:id/submit (startup submits proof)
18. Backend: POST /api/admin/milestones/:id/approve
      → validate status = "submitted"
      → call releaseMilestone() on contract
      → store txHash + update milestone + campaign
19. Frontend: Milestone list on campaign page
20. Frontend: Startup dashboard → submit proof form

Checkpoint: Startup submits. Admin approves via Postman. Funds released. txHash logged.
```

### Phase 5: Dashboards (Day 4–5)
```
21. Backend: GET /api/dashboard/investor (portfolio aggregation)
22. Backend: GET /api/dashboard/startup (raised + milestones + releases)
23. Frontend: Investor dashboard (portfolio, campaigns, tx links)
24. Frontend: Startup dashboard (funds, milestones, progress)
25. Frontend: Campaign browse + filter page

Checkpoint: Both dashboards work. Demo flow is end-to-end completable.
```

### Phase 6: Polish + Demo Prep (Day 5–6)
```
26. Credibility score computation (heuristic on campaign create)
27. Score display on browse + detail pages
28. Progress updates (startup posts update, investor sees feed)
29. Seed data: 3 startups, 2 investors, 1 active campaign with real txs
30. Polygonscan deeplinks on every txHash in UI
31. Mobile-responsive polish
32. [Optional] Alchemy WebSocket listener as backup
33. README + demo flow script

Checkpoint: Platform is demo-ready. Full flow can be walked through in 5 minutes.
```

---

## 7. Definitive Architecture Decision Log

| Decision | Choice | Rationale |
|---|---|---|
| Contract deployment | Single global contract | One deploy, one ABI, one address |
| Campaign identification | MongoDB ObjectId as bytes32 key | Same ID in DB and on-chain, no sync |
| Transaction recording | Frontend POST after tx.wait() | Simple, reliable, no WebSocket dependency |
| Transaction verification | Backend getTransaction() check | Lightweight fraud prevention |
| Event listener | Optional (Phase 6) | Not a core dependency |
| Admin role | Backend JWT-protected API only | No UI needed, Postman works for demo |
| Milestone approval | Admin POST API → contract call | Simple, auditable, demo-friendly |
| Auth | Stateless JWT with role in payload | Standard, no session store |
| Chain | Polygon Mumbai (testnet) | Near-zero gas, EVM, fast finality |
| Documents | URL fields only | IPFS deferred post-hackathon |
| Circuit breaker | ❌ Not implemented | Testnet, no real money |
| Reconciliation | ❌ Not implemented | Frontend-first recording is sufficient |
| Refund UI | ❌ Not implemented | Contract supports it, UI deferred |
| Production scaling | ❌ Not in scope | Hackathon = <10 concurrent users |

---

## The Demo Narrative (Updated)

```
1. Startup registers → creates profile → launches campaign
   [Backend creates campaign in MongoDB + calls createCampaign() on contract]

2. Investor browses campaigns → sees credibility score → clicks Invest
   [MetaMask popup → investor signs → ethers waits → frontend posts txHash]

3. txHash appears in investor dashboard with Polygonscan link
   [Anyone can verify the investment on Polygonscan right now]

4. Startup submits milestone proof via dashboard form

5. Admin approves via Postman → contract releases 30% of funds
   [Demo narrative: "In production this is DAO-governed voting"]

6. Release txHash appears in BOTH dashboards with Polygonscan link
   [Trust is proven, not claimed]
```

This is a complete, buildable, demo-stable, hackathon-appropriate architecture.
```
