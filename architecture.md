# High-Level Architecture — Transparent Investment Platform

> Architecture Mode — No implementation code. Buildable, realistic, hackathon-first design.

---

## 1. Overall Architecture

The system is a **3-tier hybrid application** with a blockchain enforcement layer.

```
┌─────────────────────────────────────────────────────────────────────┐
│                          TIER 1: CLIENT                             │
│                                                                     │
│   Next.js App (Vercel)                                              │
│   ┌───────────────────┐    ┌──────────────────────────────────┐    │
│   │  UI / Pages       │    │  Web3 Layer                      │    │
│   │  - Public pages   │    │  - MetaMask connection           │    │
│   │  - Dashboards     │    │  - ethers.js contract calls      │    │
│   │  - Auth forms     │    │  - Wallet state management       │    │
│   └────────┬──────────┘    └──────────────────┬───────────────┘    │
└────────────│─────────────────────────────────│────────────────────┘
             │ HTTPS REST                       │ RPC (direct tx signing)
             ▼                                  ▼
┌────────────────────────┐         ┌────────────────────────────────┐
│     TIER 2: BACKEND    │         │    POLYGON BLOCKCHAIN          │
│                        │         │                                │
│  Express.js API        │◄───────►│  InvestmentEscrow.sol          │
│  (Railway / Render)    │ ethers  │  (one per startup campaign)    │
│                        │  .js    │                                │
│  - Auth & JWT          │         │  - Holds investor funds        │
│  - Business logic      │         │  - Milestone-gated release     │
│  - Contract deployer   │         │  - Refund on failure           │
│  - Event indexer       │         │  - Emits events                │
└──────────┬─────────────┘         └────────────────────────────────┘
           │ Mongoose                          ▲
           ▼                                  │ WebSocket (Alchemy)
┌────────────────────────┐                    │
│     TIER 3: DATABASE   │    Backend listens for on-chain events
│                        │    and syncs to MongoDB
│  MongoDB Atlas         │
│  - Users               │
│  - Startup profiles    │
│  - Investments (ref)   │
│  - Milestones          │
│  - Fund releases       │
└────────────────────────┘
```

**Design principle**: The blockchain enforces financial rules. The backend and database handle everything else. The frontend connects both worlds.

---

## 2. Frontend Responsibilities

**Technology**: Next.js (App Router) + ethers.js + Tailwind/custom CSS

### What the frontend owns:

| Area | Responsibility |
|---|---|
| **Routing** | Public pages, protected investor routes, protected startup routes |
| **Auth state** | Store JWT in httpOnly cookie or localStorage; redirect by role |
| **API calls** | All CRUD via Axios to Express backend (REST) |
| **Wallet** | Connect MetaMask, read wallet address, sign transactions |
| **Invest flow** | Trigger on-chain `invest()` call via ethers.js + MetaMask |
| **Dashboards** | Render real-time data fetched from backend REST API |
| **Transparency** | Show txHash with deeplink to Polygonscan for every transaction |
| **UX states** | Loading, error, empty states on every data-dependent page |

### Pages required (MVP):
```
/                          → Landing page
/auth/login                → Unified login
/auth/register             → Register with role selection
/startups                  → Browse all active campaigns
/startups/[id]             → Startup detail + Invest button
/dashboard/investor        → Portfolio, investments, txs
/dashboard/startup         → Funds raised, milestones, release
/dashboard/startup/milestones → Milestone management
```

### What the frontend does NOT own:
- Fund release logic (backend triggers contract call)
- Investment validation (backend + contract handle it)
- Auth token issuance (backend owns this)

---

## 3. Backend Responsibilities

**Technology**: Node.js + Express + ethers.js + Mongoose

### What the backend owns:

| Area | Responsibility |
|---|---|
| **Auth** | Sign up, login, issue JWT, role guard middleware |
| **Startup CRUD** | Create/update profiles, validate fields, serve startup list |
| **Contract deployment** | When a campaign is created, deploy EscrowContract to Polygon |
| **Investment indexing** | Listen for `Invested` events, write to MongoDB |
| **Milestone management** | CRUD for milestones, accept proof submissions |
| **Fund release trigger** | Admin/system signs `releaseMilestone()` on-chain after approval |
| **Dashboard data APIs** | Aggregate queries for both investor and startup dashboards |
| **Notification logic** | Trigger in-app alerts on investment, milestone approved, funds released |

### What the backend does NOT own:
- Holding funds (contract handles that)
- Signing investor transactions (investor's MetaMask does that)
- Frontend rendering decisions

### API surface (high-level):
```
POST   /api/auth/register
POST   /api/auth/login

GET    /api/startups                     → list all active campaigns
POST   /api/startups                     → create startup profile + deploy contract
GET    /api/startups/:id                 → single startup detail
PATCH  /api/startups/:id                 → update startup info

GET    /api/startups/:id/milestones      → list milestones
POST   /api/startups/:id/milestones      → create milestone
PATCH  /api/milestones/:id/submit        → startup submits proof
PATCH  /api/milestones/:id/approve       → admin/system approves + triggers release

GET    /api/investments/my               → investor's own investment history
POST   /api/investments/record           → backend records investment post on-chain tx

GET    /api/dashboard/investor           → aggregated investor dashboard data
GET    /api/dashboard/startup            → aggregated startup dashboard data
```

---

## 4. Database Responsibilities

**Technology**: MongoDB + Mongoose

### What MongoDB owns:

All **application state** that does not require immutability guarantees.

```
Collection: users
Purpose: auth, profiles, wallet addresses
Key fields: email, passwordHash, role, walletAddress, kycStatus

Collection: startups
Purpose: campaign profiles, funding goals
Key fields: userId, name, description, fundingGoal, currentRaised,
            contractAddress, status, milestones[], teamMembers[]

Collection: milestones
Purpose: stages, amounts, proof, status tracking
Key fields: startupId, title, targetAmount, status
            (pending → submitted → approved → released),
            proofDocs[], txHash (on-chain release evidence)

Collection: investments
Purpose: investment records linked to on-chain transactions
Key fields: investorId, startupId, amount, txHash, confirmedAt

Collection: fundReleases
Purpose: audit log of milestone fund disbursements
Key fields: milestoneId, amount, txHash, releasedAt

Collection: notifications
Purpose: in-app notification queue
Key fields: userId, message, type, isRead, createdAt
```

### Indexing priorities:
```
startups    → index on: status, userId, contractAddress
investments → index on: investorId, startupId, txHash
milestones  → index on: startupId, status
```

### What MongoDB does NOT own:
- Source of truth for fund balances (contract owns that)
- Immutable proof of transactions (blockchain owns that)
- MongoDB is the **read-optimized cache** for what's on-chain

---

## 5. Blockchain Responsibilities

**Technology**: Solidity + Hardhat + Polygon Mumbai (testnet)

### What the smart contract owns:

| Responsibility | Description |
|---|---|
| **Fund custody** | Holds all MATIC sent by investors — not the backend, not a wallet |
| **Investor registry** | Tracks who invested how much (on-chain mapping) |
| **Milestone gates** | Defines N milestones; only releases funds for the next milestone in order |
| **Release authorization** | Only the designated `admin` (backend signer) can trigger releases |
| **Refund logic** | If campaign fails or is cancelled, investors can withdraw their share |
| **Event emission** | Emits `Invested`, `MilestoneReleased`, `Refunded` events for indexing |

### Contract instance model:
```
One InvestmentEscrow contract per startup campaign

constructor(
  address startupWallet,    // where released funds go
  address adminAddress,     // backend signer for releases
  uint256 fundingGoal,
  uint256[] milestonePcts   // e.g. [30, 40, 30] = 3 milestones
)
```

### What the contract does NOT own:
- User authentication
- Profile data
- Milestone descriptions or proof documents
- Frontend rendering state

### Why Polygon over Ethereum mainnet:
- Gas fees: ~$0.001 vs $5–50 on mainnet
- Same Solidity codebase, EVM-identical
- 2-second block finality
- Mumbai testnet → free to test

---

## 6. On-Chain vs Off-Chain Data

### On-Chain (Polygon — immutable, auditable)

| Data | Why |
|---|---|
| Investment amounts per investor address | Core financial record — must not be falsifiable |
| Total funds held in escrow per campaign | Source of truth for balances |
| Milestone release transactions | Proof of disbursement |
| Refund transactions | Investor protection record |
| `txHash` for every financial event | Cryptographic receipt |

### Off-Chain (MongoDB — fast, flexible, queryable)

| Data | Why |
|---|---|
| User accounts, credentials, roles | Personal data, auth state |
| Startup profile details, pitch info | Large text/media, editable |
| Milestone definitions, titles, amounts | Editable until submitted, large metadata |
| Milestone proof documents | Files/links, not suitable for blockchain |
| Investment records (with txHash reference) | Fast queries, join with user profiles |
| Dashboard aggregations | Computed data, expensive on-chain |
| Notifications, messages | High-frequency, ephemeral |

### The Bridge Rule:
> Every on-chain transaction generates a `txHash`.  
> That `txHash` is stored in MongoDB as the tamper-evident link.  
> Frontend shows the `txHash` with a Polygonscan deeplink — any user can independently verify.

---

## 7. How Authentication Should Work

### Architecture: Stateless JWT with Role Claims

```
┌────────────┐     POST /auth/register        ┌──────────────┐
│  User      │ ──── {email, password, role} ──► │   Backend    │
│  (Browser) │                                  │              │
│            │ ◄───── { token: JWT } ─────────── │  hashes pw   │
│            │                                  │  saves user  │
│            │                                  │  signs JWT   │
└────────────┘                                  └──────────────┘

JWT Payload:
{
  userId: "abc123",
  role: "investor" | "startup",
  email: "user@example.com",
  iat: ...,
  exp: ... (24h)
}
```

### Request flow with auth:
```
1. User logs in → backend returns JWT
2. Frontend stores JWT (localStorage for MVP; httpOnly cookie for production)
3. Every protected request includes: Authorization: Bearer <token>
4. Backend middleware decodes token → attaches req.user
5. Role guard checks req.user.role → allows or rejects
```

### Role-based access:
```
Route guard middleware:

requireAuth      → must be logged in (any role)
requireInvestor  → role === 'investor'
requireStartup   → role === 'startup'
requireAdmin     → role === 'admin' (future)
```

### Wallet linking (non-blocking for MVP):
```
After login, investor connects MetaMask in-app
Frontend sends wallet address → PATCH /api/users/wallet
Backend stores walletAddress on user document
Used later to verify on-chain investment origin
```

**Long-term**: Replace JWT storage with httpOnly cookies + refresh token rotation. Add OAuth2 (Google) login.

---

## 8. Milestone-Based Fund Release — Conceptual Flow

### State machine for each milestone:

```
PENDING → SUBMITTED → APPROVED → RELEASED
   │                               │
   └──── (admin rejects) → PENDING (resubmit allowed)
```

### Full conceptual flow:

```
Step 1: Campaign Created
  Startup defines 3 milestones with percentage split
  e.g. Milestone 1: 30% | Milestone 2: 40% | Milestone 3: 30%
  Milestone data saved in MongoDB
  InvestmentEscrow deployed with same percentage array on-chain

Step 2: Investors Fund Campaign
  Investors send MATIC to the contract
  Funds accumulate in escrow, locked

Step 3: Startup Completes Milestone 1
  Startup submits proof (URLs, docs, description) via dashboard
  Milestone status → SUBMITTED in MongoDB

Step 4: Approval (MVP: Admin triggers this)
  Admin reviews submission
  Approves in backend → triggers releaseMilestone(0) on-chain
  Backend signer wallet sends transaction to Polygon
  Smart contract calculates (30% of totalFunds) → sends to startup wallet
  Emits MilestoneReleased(0, amount) event

Step 5: Indexer catches event
  Backend Alchemy listener catches event
  MongoDB: Milestone status → RELEASED, txHash recorded
  MongoDB: FundRelease record created
  MongoDB: Startup currentReleased updated

Step 6: Both dashboards reflect update
  Investor sees: "Milestone 1 Released — $X disbursed — [View on Polygonscan]"
  Startup sees: "Milestone 1 Funds Received — Wallet +X MATIC"

Step 7: Repeat for milestones 2 and 3
```

### Why this design is safe:
- Startup cannot access funds without approval — contract blocks it
- Investors can see every release on Polygonscan independently
- Backend cannot release wrong amount — contract calculates from percentage
- If campaign fails → investors call `refund()` on contract directly

---

## 9. Recommended Request Flows

### Flow 1: Startup Creates a Campaign

```
Frontend                Backend                  MongoDB          Blockchain
   │                       │                        │                  │
   │── POST /api/startups ─►│                        │                  │
   │   {name, goal, etc}    │                        │                  │
   │                        │── save StartupProfile ─►│                  │
   │                        │   (status: pending)     │                  │
   │                        │                        │                  │
   │                        │── deployContract() ─────────────────────►│
   │                        │   (goal, milestones%)   │     Polygon RPC  │
   │                        │◄─ contractAddress ──────────────────────-│
   │                        │                        │                  │
   │                        │── update contractAddress►│                 │
   │                        │── status: active        │                  │
   │◄─ 201 {startup, addr} ─│                        │                  │
```

### Flow 2: Investor Funds a Startup

```
Frontend (MetaMask)      Backend                  MongoDB          Blockchain
   │                       │                        │                  │
   │── ethers.invest() ─────────────────────────────────────────────►│
   │   signs tx in wallet  │                        │       Polygon   │
   │◄─ txHash ─────────────────────────────────────────────────────-│
   │                       │                        │       emits     │
   │── POST /investments ──►│                        │   Invested event│
   │   {txHash, amount,    │                        │        │        │
   │    startupId}         │── save Investment ─────►│        │        │
   │                       │                        │        │        │
   │    [Separately]       │◄── Alchemy WebSocket ───────────────────│
   │                       │    catches event        │                 │
   │                       │── upsert Investment ────►│                 │
   │                       │   (idempotent, by txHash)│                │
   │◄─ 201 confirmed ──────│                        │                  │
```

### Flow 3: Milestone Fund Release

```
Startup Dashboard    Backend (Admin/System)    MongoDB          Blockchain
   │                       │                        │                  │
   │── PATCH /milestones   │                        │                  │
   │   /:id/submit ────────►│                        │                  │
   │   {proofDocs}         │── update status ───────►│                  │
   │                       │   SUBMITTED             │                  │
   │                       │                        │                  │
   │  [Admin approves]     │                        │                  │
   │                       │── releaseMilestone(i) ─────────────────►│
   │                       │   (backend signer key)  │    Polygon tx   │
   │                       │◄─ txHash ───────────────────────────────-│
   │                       │                        │     emits event  │
   │                       │── update milestone ─────►│                 │
   │                       │   RELEASED + txHash     │                 │
   │                       │── create FundRelease ───►│                 │
   │◄─ dashboard refresh ──│── update currentRaised ─►│                 │
```

### Flow 4: Investor Dashboard Data

```
Frontend                Backend                  MongoDB          Blockchain
   │                       │                        │                  │
   │── GET /dashboard      │                        │                  │
   │   /investor ──────────►│                        │                  │
   │                       │── aggregate investments─►│                  │
   │                       │── join startup names    │                  │
   │                       │── join milestone status │                  │
   │                       │◄─ data ────────────────-│                  │
   │                       │                        │                  │
   │                       │── getBalance() ──────────────────────────►│
   │                       │   (read-only, no gas)   │    ethers call  │
   │                       │◄─ live balance ─────────────────────────-│
   │◄─ merged dashboard ───│                        │                  │
│  data (DB + chain bal.)  │                        │                  │
```

---

## 10. Major Architecture Tradeoffs

### Tradeoff 1: Who approves milestones?

| Option | Pros | Cons |
|---|---|---|
| **MVP: Platform admin** | Simple, fast to build | Centralized — platform can be corrupt |
| **Future: DAO / investor vote** | Trustless, decentralized | Complex, slow, needs governance token |
| **Future: Oracle verification** | Automated, neutral | Needs reliable external proof source |

**Decision**: Admin for MVP. Document this as a known centralization risk.

---

### Tradeoff 2: JWT in localStorage vs httpOnly Cookie

| Option | Pros | Cons |
|---|---|---|
| **MVP: localStorage** | Simple, works with MetaMask flow | XSS vulnerable |
| **Production: httpOnly cookie** | XSS-safe | CSRF risk, needs refresh token |

**Decision**: localStorage for MVP. Migrate to httpOnly + refresh rotation before production.

---

### Tradeoff 3: One contract per startup vs one global contract

| Option | Pros | Cons |
|---|---|---|
| **MVP: Per-startup contract** | Isolated escrow, clean logic, easy refund | Higher deploy gas per campaign |
| **Global contract** | Single deploy, cheaper overall | Complex state management, higher risk |

**Decision**: Per-startup contract. Deploy cost on Polygon is ~$0.01. Isolation is worth it.

---

### Tradeoff 4: Backend event listener vs The Graph Protocol

| Option | Pros | Cons |
|---|---|---|
| **MVP: Alchemy WebSocket + custom listener** | No extra infra, direct control | Less resilient, re-indexing is manual |
| **Production: The Graph subgraph** | Reliable, queryable via GraphQL | Extra learning curve, separate deploy |

**Decision**: Custom Alchemy listener for MVP. The Graph for production.

---

### Tradeoff 5: Percentage-based milestone vs fixed-amount milestone

| Option | Pros | Cons |
|---|---|---|
| **Percentage (30/40/30)** | Works regardless of total raised | Startup gets less if underfunded |
| **Fixed amount** | Predictable for startup | Campaign might not hit each threshold |

**Decision**: Percentage-based, defined at campaign creation, encoded in contract.

---

### Tradeoff 6: Investor pays gas vs Platform subsidizes gas

| Option | Pros | Cons |
|---|---|---|
| **Investor pays gas (MVP)** | No cost to platform | Friction for non-crypto users |
| **Platform-subsidized (gasless)** | Better UX, wider audience | Requires meta-transaction setup (EIP-2771) |

**Decision**: Investor pays gas MVP. Use Polygon so gas ≈ $0.001 (negligible).

---

### Tradeoff 7: MongoDB as read cache vs pure on-chain queries

| Option | Pros | Cons |
|---|---|---|
| **MongoDB + txHash bridge (MVP)** | Fast queries, rich data | Two sources of truth require sync |
| **On-chain only** | Perfect consistency | Too slow, too expensive, unqueryable |

**Decision**: MongoDB is the read layer. Blockchain is the trust layer. txHash bridges them.

---

### Tradeoff 8: Fiat vs crypto investment

| Option | Pros | Cons |
|---|---|---|
| **Crypto only — MATIC (MVP)** | Simpler, blockchain-native | Excludes non-crypto users |
| **Fiat via MoonPay/Stripe** | Mass market | Complex compliance, KYC, integration cost |

**Decision**: Crypto-only for MVP. Frame as "blockchain-native investment platform" in the demo.

---

## Architecture Summary Card

```
┌─────────────────────────────────────────────────────┐
│            ARCHITECTURE SUMMARY                     │
├─────────────────┬───────────────────────────────────┤
│ Frontend        │ Next.js · ethers.js · MetaMask    │
│ Backend         │ Express · JWT · ethers.js          │
│ Database        │ MongoDB Atlas · Mongoose           │
│ Blockchain      │ Solidity · Hardhat · Polygon       │
│ Node Provider   │ Alchemy (RPC + WebSocket events)   │
│ Hosting (FE)    │ Vercel                             │
│ Hosting (BE)    │ Railway / Render                   │
│ Auth Pattern    │ Stateless JWT with role claims     │
│ Fund Model      │ Per-startup escrow contract        │
│ Release Model   │ Admin-triggered, percentage-split  │
│ Transparency    │ txHash → Polygonscan deeplink       │
└─────────────────┴───────────────────────────────────┘
```
