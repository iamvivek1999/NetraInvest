# Database Layer Design — Transparent Investment Platform

> Design Mode — Schema definitions, relationships, indexing strategy.  
> No implementation code. Designed for MongoDB + Mongoose.

---

## Collections Overview

```
┌──────────────────────────────────────────────────────┐
│              8 MONGODB COLLECTIONS (MVP)             │
├──────────────────────┬───────────────────────────────┤
│  users               │  All platform users           │
│  startup_profiles    │  Startup business info        │
│  campaigns           │  Funding requests/goals       │
│  milestones          │  Stage-based fund release     │
│  investments         │  Investor → Campaign tx refs  │
│  blockchain_txs      │  On-chain transaction log     │
│  progress_updates    │  Startup activity updates     │
│  credibility_scores  │  AI/heuristic scoring         │
└──────────────────────┴───────────────────────────────┘
```

---

## 1. Collection: `users`

**Purpose**: All platform users — investors and startups share this collection, differentiated by `role`.

```
Field                 Type        Required    Notes
──────────────────────────────────────────────────────────────────────
_id                   ObjectId    auto        Primary key
email                 String      ✅          Unique, lowercase, trimmed
passwordHash          String      ✅          bcrypt hashed, never exposed
role                  String      ✅          Enum: ["investor", "startup", "admin"]
fullName              String      ✅          Display name
phone                 String      ❌          Optional contact
walletAddress         String      ❌          Ethereum/Polygon wallet address
                                              Unique if present, null allowed
isEmailVerified       Boolean     ✅          Default: false
isActive              Boolean     ✅          Default: true (soft delete flag)
profileImage          String      ❌          URL to uploaded avatar
kycStatus             String      ❌          Enum: ["none", "pending", "verified"]
                                              Default: "none"
lastLoginAt           Date        ❌          Track engagement
createdAt             Date        auto        mongoose timestamps
updatedAt             Date        auto        mongoose timestamps
```

### Validation Rules:
- `email` → valid email format, lowercase, unique across collection
- `passwordHash` → never returned in API responses (select: false)
- `role` → strictly one of the enum values, immutable after creation
- `walletAddress` → if provided, must match `/^0x[a-fA-F0-9]{40}$/`
- `phone` → optional, E.164 format if provided

### Indexes:
```
email          → unique index          (login lookup)
walletAddress  → sparse unique index   (wallet-based lookup, nulls excluded)
role           → standard index        (filter by investor/startup)
```

---

## 2. Collection: `startup_profiles`

**Purpose**: Business information for startup users. One per startup user.

```
Field                 Type        Required    Notes
──────────────────────────────────────────────────────────────────────
_id                   ObjectId    auto
userId                ObjectId    ✅          Ref: users._id (1:1 relationship)
startupName           String      ✅          Official name, trimmed
tagline               String      ❌          Short pitch (max 150 chars)
description           String      ✅          Detailed pitch (max 2000 chars)
industry              String      ✅          Enum: ["fintech", "healthtech",
                                              "edtech", "ecommerce", "agritech",
                                              "saas", "logistics", "other"]
website               String      ❌          Must be valid URL if present
location              Object      ❌
  city                String      ❌
  country             String      ❌
foundedYear           Number      ❌          4 digit year
teamSize              Number      ❌          Min: 1
teamMembers           Array       ❌
  name                String      ✅ (in arr) 
  role                String      ✅ (in arr) 
  linkedIn            String      ❌
documents             Array       ❌          Pitch decks, financials (URLs/IPFS CIDs)
  type                String      ✅ (in arr) Enum: ["pitch_deck", "financials",
                                              "legal", "other"]
  url                 String      ✅ (in arr)
  uploadedAt          Date        auto
socialLinks           Object      ❌
  twitter             String      ❌
  linkedIn            String      ❌
  github              String      ❌
isVerified            Boolean     ✅          Default: false (admin verifies)
verifiedAt            Date        ❌
createdAt             Date        auto
updatedAt             Date        auto
```

### Relationships:
```
startup_profiles.userId → users._id   (1:1, startup user to profile)
```

### Validation Rules:
- One profile per `userId` (unique constraint on `userId`)
- `website` → valid URL format if provided
- `foundedYear` → between 1900 and current year
- `teamSize` → positive integer if provided

### Indexes:
```
userId      → unique index        (one profile per user, fast lookup)
industry    → standard index      (browse by sector)
isVerified  → standard index      (filter verified startups)
```

---

## 3. Collection: `campaigns`

**Purpose**: A startup's funding request. One active campaign per startup at a time.  
This is the central entity — investments and milestones attach to it.

```
Field                 Type        Required    Notes
──────────────────────────────────────────────────────────────────────
_id                   ObjectId    auto
startupId             ObjectId    ✅          Ref: startup_profiles._id
userId                ObjectId    ✅          Ref: users._id (startup user)
title                 String      ✅          Campaign title (max 100 chars)
summary               String      ✅          Short summary (max 300 chars)
fundingGoal           Number      ✅          In USD equivalent or MATIC
                                              Min: 100
currentRaised         Number      ✅          Default: 0, updated on each investment
currency              String      ✅          Enum: ["MATIC", "ETH"]
                                              Default: "MATIC"
status                String      ✅          Enum: ["draft", "active", "funded",
                                              "completed", "cancelled", "failed"]
                                              Default: "draft"
contractAddress       String      ❌          Polygon smart contract address
                                              Set after deployment
minInvestment         Number      ❌          Minimum per investor (default: 1 MATIC)
maxInvestment         Number      ❌          Optional cap per investor
deadline              Date        ✅          Campaign end date
milestoneCount        Number      ✅          Total number of milestones (1–5)
milestonePercentages  Array       ✅          e.g. [30, 40, 30] — must sum to 100
investorCount         Number      ✅          Default: 0, incremented on investment
currentMilestoneIndex Number      ✅          Default: 0, tracks which is next
tags                  Array       ❌          String tags for searchability
createdAt             Date        auto
updatedAt             Date        auto
```

### Relationships:
```
campaigns.startupId → startup_profiles._id   (M:1)
campaigns.userId    → users._id              (M:1)
milestones.campaignId → campaigns._id        (1:M — milestones belong to campaign)
investments.campaignId → campaigns._id       (1:M — investments into campaign)
```

### Validation Rules:
- `fundingGoal` → must be > 0
- `milestonePercentages` → must be array of numbers summing to exactly 100
- `milestonePercentages.length` → must equal `milestoneCount`
- `deadline` → must be a future date at creation
- `contractAddress` → valid Ethereum address format if set
- Only one campaign with `status: "active"` allowed per startup at a time
- `currentRaised` → never exceeds `fundingGoal`

### Indexes:
```
startupId         → standard index          (campaigns by startup)
status            → standard index          (browse active campaigns)
contractAddress   → sparse unique index     (lookup by contract)
deadline          → standard index          (expiry queries)
tags              → standard index          (searchable tags)
[status, createdAt] → compound index        (sorted active campaigns)
```

---

## 4. Collection: `milestones`

**Purpose**: Stage-based fund release definitions per campaign.  
The number of milestones and percentages are mirrored in the smart contract.

```
Field                 Type        Required    Notes
──────────────────────────────────────────────────────────────────────
_id                   ObjectId    auto
campaignId            ObjectId    ✅          Ref: campaigns._id
startupId             ObjectId    ✅          Ref: startup_profiles._id (denorm.)
index                 Number      ✅          Position: 0, 1, 2... (matches on-chain)
title                 String      ✅          e.g. "MVP Development Complete"
description           String      ✅          Detailed criteria (max 1000 chars)
percentage            Number      ✅          % of total funds for this milestone
estimatedAmount       Number      ❌          Calculated: (fundingGoal * percentage)/100
targetDate            Date        ❌          Expected completion date
status                String      ✅          Enum: ["pending", "submitted",
                                              "approved", "released", "rejected"]
                                              Default: "pending"
proofSubmission       Object      ❌          Filled when startup submits
  submittedAt         Date        ❌
  description         String      ❌          Startup's completion note
  proofLinks          Array       ❌          URLs to evidence (GitHub, demo, docs)
  documents           Array       ❌          Uploaded proof files (URLs/IPFS CIDs)
approvedBy            ObjectId    ❌          Ref: users._id (admin user)
approvedAt            Date        ❌
rejectionReason       String      ❌          Filled if admin rejects
releasedAt            Date        ❌          When funds were disbursed on-chain
releaseTxHash         String      ❌          On-chain tx hash for the release
releasedAmount        Number      ❌          Actual MATIC amount released
createdAt             Date        auto
updatedAt             Date        auto
```

### Relationships:
```
milestones.campaignId → campaigns._id    (M:1)
milestones.startupId  → startup_profiles._id   (M:1, denormalized for fast queries)
milestones.approvedBy → users._id        (admin reference)
blockchain_txs references milestones._id (via relatedEntity)
```

### Milestone State Machine:
```
PENDING → SUBMITTED (startup submits proof)
       ↓
SUBMITTED → APPROVED (admin approves)
SUBMITTED → REJECTED (admin rejects, can resubmit)
       ↓
APPROVED → RELEASED (backend triggers on-chain release, tx confirmed)
```

### Validation Rules:
- `index` → 0-based, unique per campaign, must be < `milestoneCount`
- `percentage` → positive number, total across all campaign milestones must = 100
- `releaseTxHash` → set only when `status === "released"`
- Cannot transition directly to RELEASED without APPROVED state
- Cannot resubmit if `status === "released"` or `status === "approved"`

### Indexes:
```
campaignId              → standard index         (milestones per campaign)
startupId               → standard index         (milestones per startup)
status                  → standard index         (admin review queue)
[campaignId, index]     → unique compound index  (enforces ordering uniqueness)
[campaignId, status]    → compound index         (filter by campaign + status)
```

---

## 5. Collection: `investments`

**Purpose**: Records of investor funding into campaigns. Each document = one investment event.  
MongoDB is the read-optimized layer; the on-chain event is the source of truth.

```
Field                 Type        Required    Notes
──────────────────────────────────────────────────────────────────────
_id                   ObjectId    auto
investorId            ObjectId    ✅          Ref: users._id (investor)
campaignId            ObjectId    ✅          Ref: campaigns._id
startupId             ObjectId    ✅          Ref: startup_profiles._id (denorm.)
amount                Number      ✅          Amount invested in MATIC
currency              String      ✅          Enum: ["MATIC", "ETH"] Default: "MATIC"
txHash                String      ✅          Unique — Polygon transaction hash
                                              The immutable proof of investment
investorWallet        String      ✅          Wallet address that sent the tx
status                String      ✅          Enum: ["pending", "confirmed", "failed",
                                              "refunded"]
                                              Default: "pending"
blockNumber           Number      ❌          Block where tx was mined
confirmedAt           Date        ❌          When tx was confirmed on-chain
refundedAt            Date        ❌          Set if investor received refund
refundTxHash          String      ❌          On-chain refund tx hash
note                  String      ❌          Optional investor message (max 300 chars)
createdAt             Date        auto
updatedAt             Date        auto
```

### Relationships:
```
investments.investorId  → users._id               (M:1)
investments.campaignId  → campaigns._id            (M:1)
investments.startupId   → startup_profiles._id     (M:1, denormalized)
investments.txHash      → blockchain_txs.txHash    (1:1 logical link)
```

### Validation Rules:
- `txHash` → unique constraint (prevents double-recording same investment)
- `amount` → must be > 0
- `investorWallet` → valid Ethereum address format
- `status: "refunded"` can only be set if `status` was `"confirmed"` first
- `investorId` → must have `role: "investor"` (validated at write time)

### Indexes:
```
txHash                      → unique index           (idempotent upserts)
investorId                  → standard index          (investor's portfolio)
campaignId                  → standard index          (all investments per campaign)
startupId                   → standard index          (startup's investor list)
status                      → standard index          (filter confirmed/pending)
[investorId, campaignId]    → compound index          (check if already invested)
[campaignId, confirmedAt]   → compound index          (timeline per campaign)
```

---

## 6. Collection: `blockchain_txs`

**Purpose**: Central audit log of every on-chain transaction the platform creates or observes.  
Provides a queryable, app-level ledger. The chain is still the source of truth.

```
Field                 Type        Required    Notes
──────────────────────────────────────────────────────────────────────
_id                   ObjectId    auto
txHash                String      ✅          Unique — Polygon tx hash
txType                String      ✅          Enum: ["contract_deploy",
                                              "investment", "milestone_release",
                                              "refund"]
status                String      ✅          Enum: ["pending", "confirmed", "failed"]
from                  String      ✅          Sender wallet address
to                    String      ✅          Recipient or contract address
amount                Number      ❌          MATIC value (0 for deploys)
gasUsed               Number      ❌          Gas consumed
blockNumber           Number      ❌          Block number of confirmation
network               String      ✅          Enum: ["polygon_mumbai", "polygon_mainnet"]
confirmedAt           Date        ❌
relatedEntity         Object      ❌          What this tx relates to
  entityType          String      ❌          Enum: ["campaign", "milestone",
                                              "investment", "user"]
  entityId            ObjectId    ❌          _id of the related document
polygonscanUrl        String      ❌          Pre-computed deeplink URL
createdAt             Date        auto
updatedAt             Date        auto
```

### Relationships:
```
blockchain_txs.relatedEntity.entityId → campaigns._id    OR
                                      → milestones._id   OR
                                      → investments._id
```

### Validation Rules:
- `txHash` → unique, must match `/^0x[a-fA-F0-9]{64}$/`
- `from` / `to` → valid Ethereum address format
- `txType` and `status` strictly enum-validated

### Indexes:
```
txHash                           → unique index       (primary lookup, idempotent)
txType                           → standard index     (filter by type)
status                           → standard index     (pending confirmation checks)
[relatedEntity.entityType,
 relatedEntity.entityId]         → compound index     (find all txs for an entity)
confirmedAt                      → standard index     (timeline queries)
```

---

## 7. Collection: `progress_updates`

**Purpose**: Startup posts regular updates to keep investors informed.  
Like LinkedIn posts but for campaign progress. Builds investor confidence.

```
Field                 Type        Required    Notes
──────────────────────────────────────────────────────────────────────
_id                   ObjectId    auto
campaignId            ObjectId    ✅          Ref: campaigns._id
startupId             ObjectId    ✅          Ref: startup_profiles._id
userId                ObjectId    ✅          Ref: users._id (startup user)
title                 String      ✅          Update headline (max 100 chars)
content               String      ✅          Update body (max 3000 chars)
updateType            String      ✅          Enum: ["general", "milestone_progress",
                                              "team_update", "product_update",
                                              "financial_update"]
attachments           Array       ❌          URLs/IPFS CIDs for images, docs
milestoneRef          ObjectId    ❌          Optional ref: milestones._id
                                              (links update to a specific milestone)
isPublic              Boolean     ✅          Default: true
                                              false = visible to investors only
likesCount            Number      ✅          Default: 0
viewsCount            Number      ✅          Default: 0
createdAt             Date        auto
updatedAt             Date        auto
```

### Indexes:
```
campaignId               → standard index        (updates per campaign)
startupId                → standard index
[campaignId, createdAt]  → compound index        (chronological feed)
updateType               → standard index
```

---

## 8. Collection: `credibility_scores`

**Purpose**: Store computed credibility/risk scores per startup campaign.  
MVP uses a heuristic model; later replaced with ML scoring.

```
Field                 Type        Required    Notes
──────────────────────────────────────────────────────────────────────
_id                   ObjectId    auto
startupId             ObjectId    ✅          Ref: startup_profiles._id
campaignId            ObjectId    ❌          Optional campaign-specific score
overallScore          Number      ✅          0–100 composite score
riskLevel             String      ✅          Enum: ["low", "medium", "high", "very_high"]
                                              Derived from overallScore
scoreBreakdown        Object      ✅
  profileCompleteness Number      ✅          0–100: How complete the profile is
  teamCredibility     Number      ✅          0–100: LinkedIn profiles, team size
  documentScore       Number      ✅          0–100: Pitch deck, financials uploaded
  milestoneClarity    Number      ✅          0–100: Are milestones well-defined
  fundingRealism      Number      ✅          0–100: Is the goal realistic for industry
  pastPerformance     Number      ❌          0–100: If startup has prior campaigns
scoringVersion        String      ✅          e.g. "heuristic_v1", "ml_v2"
                                             (track which scoring model was used)
scoringNotes          Array       ❌          Human-readable score explanations
  factor              String
  impact              String      Enum: ["positive", "negative", "neutral"]
  note                String
computedAt            Date        ✅          When this score was computed
expiresAt             Date        ✅          Score validity window (recompute after)
createdAt             Date        auto
updatedAt             Date        auto
```

### Heuristic Score Formula (MVP):
```
overallScore = (
  profileCompleteness * 0.20 +
  teamCredibility     * 0.20 +
  documentScore       * 0.15 +
  milestoneClarity    * 0.25 +
  fundingRealism      * 0.20
) → rounded to 2 decimal places

riskLevel:
  80–100  → "low"
  60–79   → "medium"
  40–59   → "high"
   0–39   → "very_high"
```

### Indexes:
```
startupId                 → standard index         (score per startup)
campaignId                → standard index
overallScore              → standard index          (sort by score on discovery)
riskLevel                 → standard index          (filter by risk)
expiresAt                 → standard index          (recompute scheduler)
```

---

## Entity Relationship Map

```
users (1) ─────────────────── (1) startup_profiles
  │                                     │
  │ (investor)                          │ (1)
  │                                     │
  └──(M)─── investments ──(M)──── campaigns ──(1:M)── milestones
                │                      │                   │
                │                      │ (1:M)             │ (release tx)
                │                 progress_updates         │
                │                      │              blockchain_txs
                └──────────────── blockchain_txs ──────────┘
                    (investment tx)

startup_profiles ──(1:1)── credibility_scores
```

---

## Cross-Collection Relationship Summary

| Source                  | Field          | Target                  | Type |
|-------------------------|----------------|-------------------------|------|
| startup_profiles        | userId         | users                   | 1:1  |
| campaigns               | startupId      | startup_profiles        | M:1  |
| campaigns               | userId         | users                   | M:1  |
| milestones              | campaignId     | campaigns               | M:1  |
| investments             | investorId     | users                   | M:1  |
| investments             | campaignId     | campaigns               | M:1  |
| blockchain_txs          | relatedEntity  | any collection          | poly |
| credibility_scores      | startupId      | startup_profiles        | 1:1  |
| progress_updates        | campaignId     | campaigns               | M:1  |

---

## Global Data Integrity Rules

1. **Soft deletes only** — set `isActive: false` on users, never hard delete
2. **Idempotent writes** — all blockchain data upserted by `txHash`
3. **Denormalization deliberate** — `startupId` on `investments` and `milestones` is intentional for query speed
4. **Timestamps always** — all collections use Mongoose `timestamps: true`
5. **No raw passwords** — `passwordHash` always has `select: false` in schema
6. **Amount precision** — store amounts as full MATIC units (Number), not wei; convert at service layer
7. **Enum enforcement** — all enum fields validated at schema level, never trust raw input
8. **Score expiry** — credibility scores expire after 7 days and are recomputed on demand

---

## Quick Reference Summary Table

| Collection          | Key Field(s)                     | Critical Index              | Unique Constraint     |
|---------------------|----------------------------------|-----------------------------|-----------------------|
| users               | email, role, walletAddress       | email, walletAddress        | email, walletAddress  |
| startup_profiles    | userId, industry                 | userId, isVerified          | userId                |
| campaigns           | startupId, status, contractAddr  | status, contractAddress     | contractAddress       |
| milestones          | campaignId, index, status        | [campaignId, index]         | [campaignId, index]   |
| investments         | txHash, investorId, campaignId   | txHash, [investor,campaign] | txHash                |
| blockchain_txs      | txHash, txType, relatedEntity    | txHash, relatedEntity       | txHash                |
| progress_updates    | campaignId, updateType           | [campaignId, createdAt]     | —                     |
| credibility_scores  | startupId, riskLevel, score      | startupId, overallScore     | startupId             |
