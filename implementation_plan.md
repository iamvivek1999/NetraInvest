# Transparent Investment Platform — System Analysis

> **Analysis Mode Only** — No code, APIs, or implementations are generated here.  
> This document is a complete structural breakdown for the next engineering phase.

---

## 1. System Overview

A **decentralized-trust investment platform** that connects small investors with early-stage startups. The platform uses a hybrid architecture: a traditional web application (for UX, profiles, and dashboards) backed by Ethereum/Polygon smart contracts (for immutable transaction records and milestone-gated fund release). Trust is enforced by the blockchain — not by the platform itself.

**Core Promise to Users:**
- To investors: *"Your money cannot be misused — funds are released only on verified milestones."*
- To startups: *"Get real funding with a credible, auditable track record."*

---

## 2. Roles & Entities

### User Roles
| Role | Responsibilities | Access |
|---|---|---|
| **Investor** | Browse startups, deposit funds, track investments | Investor Dashboard, Startup Profiles |
| **Startup** | Create profile, define milestones, request fund releases | Startup Dashboard, Funding Campaign |
| **Admin** (future) | Verify startups, approve milestone completions | Admin Panel |
| **Smart Contract** | Autonomous escrow — holds and releases funds by rules | On-chain only |

### Core Data Entities

```
User
├── id, email, passwordHash, role (investor|startup)
├── walletAddress (linked Ethereum wallet)
└── kycStatus, createdAt

StartupProfile
├── id, userId (FK), name, description, pitch
├── fundingGoal, currentRaised, status (active|funded|closed)
├── teamMembers[], documents[], tags[]
└── contractAddress (deployed escrow contract)

Milestone
├── id, startupId (FK), title, description
├── targetAmount, status (pending|submitted|approved|released)
├── proofDocuments[], submittedAt, approvedAt
└── onChainMilestoneIndex

Investment
├── id, investorId (FK), startupId (FK)
├── amount, txHash (blockchain), timestamp
└── status (pending|confirmed|refunded)

FundRelease
├── id, milestoneId (FK), amount
├── txHash, releasedAt, approvedBy
└── status (pending|executed)

Notification
├── userId, type, message, isRead, createdAt
```

---

## 3. Component Breakdown

### Frontend (Next.js)
```
┌─────────────────────────────────────────────┐
│             Next.js Application             │
├─────────────────┬───────────────────────────┤
│   Public Pages  │   Authenticated Pages      │
│  ─ Landing      │  ─ Investor Dashboard      │
│  ─ Startup List │  ─ Startup Dashboard       │
│  ─ Startup View │  ─ Investment Flow         │
│  ─ Auth Pages   │  ─ Milestone Tracker       │
└─────────────────┴───────────────────────────┘
         │                    │
    Web3 Layer (ethers.js)   REST API (axios)
         │                    │
   MetaMask/Wallet      Express Backend
```

### Backend (Node.js + Express)
```
┌──────────────────────────────────────┐
│           Express API Server         │
├──────────────┬───────────────────────┤
│  Auth Module │  Business Logic       │
│  ─ JWT       │  ─ Startup Service    │
│  ─ Middleware│  ─ Investment Service │
│              │  ─ Milestone Service  │
│              │  ─ Notification Svc   │
├──────────────┴───────────────────────┤
│          Blockchain Module           │
│  ─ Contract Deploy (startup reg)     │
│  ─ Transaction Listener              │
│  ─ Event Indexer                     │
├──────────────────────────────────────┤
│            MongoDB (Mongoose)        │
└──────────────────────────────────────┘
```

### Blockchain Layer (Solidity on Polygon)
```
┌──────────────────────────────────────────┐
│        InvestmentEscrow.sol              │
│                                          │
│  Per-Startup Contract Instance           │
│  ─ receive() → accept ETH/MATIC          │
│  ─ invest()  → record investor + amount  │
│  ─ releaseMilestone() → gated release    │
│  ─ refund()  → if campaign fails         │
│  ─ getBalance()                          │
│  ─ Events: Invested, Released, Refunded  │
└──────────────────────────────────────────┘
```

---

## 4. High-Level System Architecture

```
┌────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                        │
│   Next.js App  ←─── MetaMask Wallet (Web3 Signer)         │
└──────────────────────────┬─────────────────────────────────┘
                           │  HTTPS + WebSocket
┌──────────────────────────▼─────────────────────────────────┐
│                       API LAYER                            │
│   Express.js REST API  (JWT Auth, Role Guards)             │
│   ─ /api/auth   /api/startups   /api/investments           │
│   ─ /api/milestones   /api/dashboard   /api/blockchain     │
└──────────┬─────────────────────────────────┬───────────────┘
           │                                 │
┌──────────▼──────────┐         ┌────────────▼───────────────┐
│    MongoDB Atlas    │         │   Blockchain Node (Polygon) │
│  (Off-chain store)  │         │   via Alchemy / Infura RPC  │
│  ─ Users            │         │   ethers.js / web3.js       │
│  ─ Profiles         │         │   ─ Deploy contracts        │
│  ─ Investments      │         │   ─ Listen to events        │
│  ─ Milestones       │         │   ─ Query balances          │
└─────────────────────┘         └────────────────────────────┘
                                          │
                               ┌──────────▼──────────┐
                               │  Polygon Blockchain  │
                               │  InvestmentEscrow    │
                               │  Smart Contracts     │
                               └─────────────────────┘
```

---

## 5. Data Flow — End to End

### Flow A: Startup Registration & Campaign Creation
```
1. Startup fills profile form (Frontend)
2. JWT-authenticated POST /api/startups (Backend)
3. Backend saves profile to MongoDB
4. Backend deploys InvestmentEscrow.sol contract for this startup
   → Gets contractAddress back from Polygon
5. contractAddress stored in MongoDB StartupProfile document
6. Startup defines milestones → saved to MongoDB
7. Campaign goes LIVE → visible on platform
```

### Flow B: Investor Funding a Startup
```
1. Investor views startup profile (Frontend fetches from /api/startups/:id)
2. Investor clicks "Invest" → enters amount
3. Frontend calls ethers.js → MetaMask popup triggers
4. Investor signs transaction → sends MATIC to startup's contractAddress
5. Polygon confirms transaction → emits Invested(investor, amount) event
6. Backend event listener catches the event (via WebSocket to Alchemy/Infura)
7. Backend writes Investment record to MongoDB (txHash, amount, investorId)
8. currentRaised updated on StartupProfile
9. Investor Dashboard updates in real-time (or on next load)
```

### Flow C: Milestone Completion & Fund Release
```
1. Startup submits milestone proof (docs/links) via dashboard
2. Backend updates Milestone.status = "submitted" in MongoDB
3. Admin (or automated oracle) reviews and approves milestone
4. Backend calls releaseMilestone() on the smart contract
   → Backend wallet (admin signer) sends tx to Polygon
5. Smart contract verifies milestone index → transfers funds to startup wallet
6. Emits Released(milestoneIndex, amount) event
7. Backend listener catches event → updates FundRelease record in MongoDB
8. Both Investor and Startup dashboards reflect the release
```

### Flow D: Real-time Dashboard Updates
```
MongoDB ← Backend ← Blockchain Events (WebSocket listener)
      ↓
  REST API polling / WebSocket push
      ↓
  Next.js Dashboard (SWR / React Query for data refresh)
```

---

## 6. What Goes On-Chain vs Off-Chain

### On-Chain (Immutable, Trustless)
| Item | Reason |
|---|---|
| Investment transactions (amount, investor address) | Cannot be falsified |
| Fund balance per startup contract | Transparent escrow |
| Milestone release transactions | Auditable fund disbursement |
| Refund transactions | Investor protection |
| Transaction hashes (event logs) | Proof of actions |

### Off-Chain (MongoDB — Efficiency & UX)
| Item | Reason |
|---|---|
| User profiles, auth credentials | Personal data, fast queries |
| Startup descriptions, pitch decks | Large unstructured data |
| Milestone definitions + proof docs | Editable until submitted |
| Notification/messaging state | High-frequency, low-criticality |
| UI-facing aggregated analytics | Expensive to compute on-chain |
| Role-based access control | Application-level concern |

> **Hybrid Pattern**: Store `txHash` in MongoDB for every on-chain action. Frontend can independently verify any record by looking it up on a block explorer (Polygonscan).

---

## 7. Blockchain Integration Architecture

```
┌─────────────────────────────────────────────────────────┐
│                 BLOCKCHAIN INTEGRATION                  │
├────────────────────┬────────────────────────────────────┤
│   WRITE FLOW       │   READ FLOW                        │
│  (User Actions)    │  (Dashboard Data)                  │
│                    │                                    │
│  MetaMask (user)   │  ethers.js (backend)               │
│       ↓            │       ↓                            │
│  ethers.js (FE)    │  Alchemy/Infura WebSocket          │
│       ↓            │       ↓                            │
│  Polygon RPC       │  Event Listener (backend)          │
│       ↓            │       ↓                            │
│  Smart Contract    │  MongoDB write (indexed)           │
│       ↓            │       ↓                            │
│  Event emitted     │  REST API response (cached)        │
└────────────────────┴────────────────────────────────────┘
```

**Key Design Decisions:**
- **Fund reads**: Backend reads balance from contract via ethers.js (provider)
- **Fund writes (invest)**: User-signed from MetaMask (no backend key needed)
- **Fund release**: Backend/admin wallet signs the release transaction (controlled)
- **Verification**: Anyone can verify txHash on Polygonscan independently

**Why Polygon over Ethereum Mainnet:**
- Gas fees are ~0.001¢ vs $5–50 on Ethereum
- Same Solidity code, EVM-compatible
- Fast finality (~2s block time)
- Ideal for a hackathon/MVP with real transactions

---

## 8. Critical Challenges & Tradeoffs

### Challenge 1: Trust in Milestone Approval
**Problem**: Who decides a milestone is "done"? If the platform admin approves, it's centralized.  
**Tradeoff**: MVP → Admin-approved. Future → DAO voting or oracle-based verification.

### Challenge 2: Wallet Onboarding Friction
**Problem**: Investors need MetaMask + MATIC to invest. High friction for non-crypto users.  
**Tradeoff**: MVP → crypto-native users only. Future → fiat on-ramp (MoonPay) or custodial wallet.

### Challenge 3: Smart Contract Bugs
**Problem**: Once deployed, contracts are immutable. A bug means lost funds.  
**Tradeoff**: MVP → use upgradeable proxy pattern (OpenZeppelin) or testnet-only. Audit before mainnet.

### Challenge 4: Event Lag / Indexing Reliability
**Problem**: Blockchain events may arrive out-of-order or with delays.  
**Tradeoff**: Use Alchemy webhooks + idempotent MongoDB writes (upsert by txHash).

### Challenge 5: Legal & Regulatory Risk
**Problem**: Investment platforms may require financial licenses (SEC, SEBI).  
**Tradeoff**: Frame as "donation/pledge model" for MVP, not securities. Real launch → legal review.

### Challenge 6: Gas Price Volatility
**Problem**: If backend pays gas for releases, it's a cost center.  
**Tradeoff**: Startups pay gas for release requests. Or use Polygon's near-zero gas.

---

## 9. MVP Scope (Hackathon-Ready)

### ✅ In MVP
- User auth (Investor + Startup roles) — JWT
- Startup profile creation with funding goal + 3–5 milestones
- Investor can browse and invest via MetaMask (Polygon Mumbai testnet)
- Smart contract escrow per startup (InvestmentEscrow.sol)
- On-chain investment recording + event indexing to MongoDB
- Admin-triggered milestone fund release (on-chain)
- Investor dashboard: portfolio, txHash links, startup progress
- Startup dashboard: funds raised, milestone status, release history
- Polygonscan link for every transaction (transparency proof)

### ❌ Deferred (Post-MVP)
- KYC / document verification
- AI risk scoring
- Chat system
- Mobile app / PWA
- DAO-based milestone voting
- Fiat on-ramp
- Admin panel UI

---

## 10. Good-to-Have Feature Analysis

| Feature | Value | Complexity | Priority |
|---|---|---|---|
| **AI Risk Scoring** | High — builds investor confidence | Medium (use OpenAI API + heuristics) | Phase 2 |
| **Fraud/Anomaly Detection** | High — platform trust | High (ML pipeline) | Phase 3 |
| **Chat System** | Medium — investor-startup comms | Low (Socket.io) | Phase 2 |
| **Rating & Reviews** | Medium — social proof | Low | Phase 2 |
| **PWA/Mobile** | High — reach | Medium (Next.js PWA config) | Phase 2 |

---

## 11. Suggested Project Folder Structure

```
enigma-invest/
├── frontend/                        # Next.js App
│   ├── app/
│   │   ├── (auth)/                  # Login, Register pages
│   │   ├── dashboard/
│   │   │   ├── investor/            # Investor Dashboard
│   │   │   └── startup/             # Startup Dashboard
│   │   ├── startups/
│   │   │   ├── page.tsx             # Browse Startups
│   │   │   └── [id]/page.tsx        # Startup Detail + Invest
│   │   └── layout.tsx
│   ├── components/
│   │   ├── ui/                      # Reusable UI (cards, buttons)
│   │   ├── charts/                  # Investment progress charts
│   │   └── blockchain/              # Wallet connect, tx status
│   ├── lib/
│   │   ├── api.ts                   # Axios client
│   │   ├── ethers.ts                # ethers.js helpers
│   │   └── auth.ts                  # JWT token helpers
│   └── public/
│
├── backend/                         # Express.js API
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.ts                # MongoDB connection
│   │   │   └── blockchain.ts        # ethers provider setup
│   │   ├── models/
│   │   │   ├── User.ts
│   │   │   ├── Startup.ts
│   │   │   ├── Milestone.ts
│   │   │   ├── Investment.ts
│   │   │   └── FundRelease.ts
│   │   ├── routes/
│   │   │   ├── auth.routes.ts
│   │   │   ├── startup.routes.ts
│   │   │   ├── investment.routes.ts
│   │   │   ├── milestone.routes.ts
│   │   │   └── dashboard.routes.ts
│   │   ├── controllers/             # Route handlers
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts   # JWT verify
│   │   │   └── role.middleware.ts   # Investor/Startup guard
│   │   ├── services/
│   │   │   ├── contract.service.ts  # Deploy + call contracts
│   │   │   └── event.listener.ts    # Blockchain event indexer
│   │   └── index.ts                 # Entry point
│   └── .env
│
├── blockchain/                      # Hardhat Project
│   ├── contracts/
│   │   └── InvestmentEscrow.sol     # Core smart contract
│   ├── scripts/
│   │   └── deploy.ts                # Deployment script
│   ├── test/
│   │   └── escrow.test.ts
│   ├── artifacts/                   # ABI + bytecode (auto-generated)
│   └── hardhat.config.ts
│
└── README.md
```

---

## 12. Suggested Improvements / Optimizations

1. **Use The Graph Protocol** — Index blockchain events into a GraphQL subgraph instead of a manual event listener. Faster, more resilient.
2. **OpenZeppelin Contracts** — Use battle-tested Escrow and AccessControl contracts. Don't reinvent the wheel.
3. **Upgradeable Contracts** — Use UUPS proxy pattern so contract logic can be updated without redeploying escrow.
4. **React Query / SWR** — For smart frontend caching of investment data (avoid re-fetching on every render).
5. **Alchemy Notify Webhooks** — Instead of polling, receive push notifications for on-chain events.
6. **IPFS for Documents** — Store pitch decks and milestone proofs on IPFS (decentralized, tamper-proof). Store CID in MongoDB.
7. **Role-Based JWT Claims** — Encode role inside the JWT payload to reduce DB lookups on every request.
8. **Rate Limiting + Helmet.js** — Basic API security from day one, not an afterthought.
9. **Docker Compose** — Containerize backend + MongoDB for easy local dev and deployment.
10. **Etherscan Deeplinks** — Every transaction in the UI links directly to `polygonscan.com/tx/{txHash}` for public audit.

---

## Summary Table

| Layer | Technology | Responsibility |
|---|---|---|
| Frontend | Next.js + ethers.js | UI, wallet interaction, data display |
| Backend API | Node.js + Express | Auth, business logic, DB operations |
| Database | MongoDB + Mongoose | Off-chain persistent storage |
| Blockchain | Solidity + Hardhat | Escrow, fund release, immutable ledger |
| Network | Polygon (Mumbai testnet) | Low-cost EVM-compatible chain |
| Auth | JWT + bcrypt | Secure stateless session management |
| Events | Alchemy WebSocket | Real-time blockchain event indexing |
| Hosting | Vercel (FE) + Railway/Render (BE) | Easy deployment for hackathon |
