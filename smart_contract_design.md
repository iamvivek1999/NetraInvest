# Smart Contract Design — InvestmentPlatform.sol

> Design document only. No Solidity implementation yet.
> Target: Polygon Mumbai testnet. Single global contract.

---

## 1. Contract Responsibilities

The contract is the **financial source of truth**. It does one thing reliably: hold investor funds in escrow and release them in predetermined tranches when authorized.

It does NOT replicate business logic that already lives in MongoDB. It is not a general-purpose platform — it is a purpose-built escrow with a milestone release schedule.

**Contract is responsible for:**
- Registering a campaign's on-chain identity and escrow configuration
- Accepting and holding investor MATIC
- Releasing milestone tranches to the startup wallet on admin authorization
- Emitting immutable, publicly verifiable events for every financial action

**Contract is NOT responsible for:**
- Storing startup names, descriptions, or documents
- Managing user accounts, JWT auth, or roles
- Enforcing proof submission or review workflow
- Pagination, search, or discovery
- Investor KYC / identity

---

## 2. On-Chain vs Off-Chain Boundary

| Concern | Where |
|---|---|
| Campaign financial config (goal, deadline, milestone %) | **On-chain** |
| Holding investor funds (escrow) | **On-chain** |
| Recording total raised per campaign | **On-chain** |
| Per-investor contribution amount | **On-chain** (needed for future refund) |
| Releasing milestone tranches | **On-chain** |
| Emitting verifiable events | **On-chain** |
| Startup profile / team / documents | Off-chain (MongoDB) |
| Milestone proof submission and text | Off-chain (MongoDB) |
| Admin review and approval workflow | Off-chain (MongoDB + JWT) |
| Campaign title, tags, summary | Off-chain (MongoDB) |
| User registration and authentication | Off-chain (MongoDB + JWT) |
| Investment transaction records (with context) | Off-chain (MongoDB), linked by txHash |
| Pagination, filtering, search | Off-chain |

---

## 3. Campaign Data Stored On-Chain

The contract stores the minimum data needed to govern escrow and release.

```
Struct Campaign {
    address  startupWallet          // receives released funds
    uint256  fundingGoal            // in wei (MATIC × 10^18)
    uint256  deadline               // Unix timestamp (seconds)
    uint256  totalRaised            // accumulated investment in wei
    uint8    milestoneCount         // 1–5
    uint8[5] milestonePercentages   // fixed-size, indices 0–4, unused = 0
    uint8    currentMilestoneIndex  // which release is next
    bool     exists                 // creation guard (prevents re-creation)
    bool     isOpen                 // false after deadline or cancellation
}
```

**Why `uint8[5]` for milestonePercentages?**
- Percentages fit in 0–100, so `uint8` (0–255) is sufficient
- Fixed-size array avoids dynamic array overhead in storage
- Max 5 elements = negligible storage cost on Polygon

**Why store `totalRaised` on-chain?**
- Makes release calculation fully deterministic on-chain
- Release amount = `totalRaised × milestonePercentages[i] / 100`
- Auditable without querying MongoDB

**What is NOT in the struct** (intentionally):
- Startup name, description, documents → MongoDB
- Investor list → per-investor mapping (separate, not in struct)
- Milestone titles, proof → MongoDB

---

## 4. Investment Flow (On-Chain)

```
Investor (frontend) ──► invest(campaignKey) [payable] ──► Contract
                                                               │
                          Validations:                         │
                          ✓ campaign exists                    │
                          ✓ campaign.isOpen == true            │
                          ✓ block.timestamp < campaign.deadline│
                          ✓ msg.value > 0                      │
                                                               │
                          Effects:                             │
                          + investments[campaignKey][msg.sender] += msg.value
                          + campaign.totalRaised += msg.value  │
                                                               │
                          Emit:  InvestmentReceived(...)       │
                                                               ▼
                                                     Funds held in contract
```

**Per-investor tracking rationale:**
`mapping(bytes32 => mapping(address => uint256)) investments`

Even though refunds are deferred, this data must be collected now. Adding it later would require a contract upgrade or data migration — neither is acceptable for an escrow system. The gas cost of one additional SSTORE per investment is negligible on Polygon.

**What the frontend does after `invest()`:**
1. Calls `invest(campaignKey)` with MATIC value attached
2. Waits for `tx.wait()` (2–3 seconds on Polygon)
3. POSTs `{ campaignId, txHash, amount }` to `POST /api/v1/investments`
4. Backend verifies txHash on-chain via provider, then writes to MongoDB

**What backend does NOT do during investment:**
- Backend does NOT sign or submit the invest transaction
- The investor's own MetaMask signs it directly
- This keeps the frontend-first investment flow intact

---

## 5. Milestone Release Flow (On-Chain)

```
Admin approves milestone in MongoDB (off-chain review complete)
        │
        ▼
Admin calls POST /api/v1/campaigns/:id/milestones/:id/release (backend)
        │
        ▼
Backend (admin wallet signer) calls:
   contract.releaseMilestone(campaignKey, milestoneIndex)
        │
        Validations (on-chain):
        ✓ campaign exists
        ✓ msg.sender == adminWallet (operator check)
        ✓ milestoneIndex == campaign.currentMilestoneIndex (sequential)
        ✓ milestoneIndex < campaign.milestoneCount
        │
        Computation:
        releaseAmount = campaign.totalRaised
                        × campaign.milestonePercentages[milestoneIndex]
                        / 100
        │
        Effects:
        + campaign.currentMilestoneIndex += 1
        + if (currentMilestoneIndex == milestoneCount): campaign.isOpen = false
        + transfer(releaseAmount → campaign.startupWallet)
        │
        Emit: MilestoneReleased(campaignKey, milestoneIndex, releaseAmount, startupWallet)
        │
        ▼
Backend receives tx receipt → writes releaseTxHash, releasedAmount, releasedAt to MongoDB
Backend sets milestone.status → 'released' in MongoDB
```

**Why is release amount based on `totalRaised`, not `fundingGoal`?**
- More honest and auditable: startups receive what was actually collected
- Avoids empty-escrow scenarios if goal is not met but campaign still runs
- Simpler than a "minimum threshold" check for hackathon MVP

---

## 6. Campaign Creation On-Chain

**Who calls `createCampaign()`:**
→ **Backend admin wallet only** (not the startup's wallet)

**Justification:**
- Campaign activation is a platform decision (admin publishes it)
- Startups do not need to sign a transaction to create a campaign
- Eliminates startup MetaMask signing friction at campaign creation time
- One signer = one private key to manage = simpler for hackathon
- Investors still sign their own `invest()` transactions directly

**When it is called:**
When the startup calls `PATCH /api/v1/campaigns/:id` with `{ status: 'active' }`, Phase 2 backend will:
1. Generate the `campaignKey` (random `bytes32`)
2. Call `contract.createCampaign(campaignKey, startupWallet, fundingGoal, deadline, count, percentages)`
3. Wait for `tx.wait()`
4. Write `campaignKey`, `contractAddress`, `isContractDeployed: true` to MongoDB

---

## 7. Role Model (On-Chain)

The contract has exactly two roles:

| Role | Who | What they can do |
|---|---|---|
| `owner` / `operator` | Admin wallet (backend server) | `createCampaign`, `releaseMilestone`, `setCampaignOpen` |
| Investor (any EOA) | Anyone | `invest` (only this) |

**Implementation:** Single `owner` address set at deployment. No OpenZeppelin `AccessControl` needed — too much overhead for MVP. A simple `require(msg.sender == owner)` modifier on admin-only functions is sufficient.

```
modifier onlyOwner() {
    require(msg.sender == owner, "Not authorized");
    _;
}
```

**Rationale for not using multi-sig or governance:**
- Hackathon MVP: speed and reliability over decentralization
- Admin wallet key is held server-side in `.env`
- Post-hackathon: replace `owner` with a multi-sig (Gnosis Safe) or DAO

---

## 8. Events to Emit

Every financial action emits an event. Events are the transparency layer — investors can audit the entire campaign history from the chain without trusting the backend.

```
event CampaignCreated(
    bytes32 indexed campaignKey,
    address indexed startupWallet,
    uint256 fundingGoal,
    uint256 deadline,
    uint8   milestoneCount
);

event InvestmentReceived(
    bytes32 indexed campaignKey,
    address indexed investor,
    uint256 amount,          // this specific investment in wei
    uint256 totalRaised      // new cumulative total after this investment
);

event MilestoneReleased(
    bytes32 indexed campaignKey,
    uint8   milestoneIndex,
    uint256 amount,          // MATIC released to startup
    address recipient        // startup wallet
);

event CampaignCompleted(
    bytes32 indexed campaignKey,
    uint256 totalRaised      // final total
);
```

**Deferred events (not in MVP):**
```
event InvestmentRefunded(bytes32 campaignKey, address investor, uint256 amount);
event CampaignCancelled(bytes32 campaignKey);
```

**Why `indexed` on campaignKey and investor?**
- Allows frontend/backend to efficiently filter logs without scanning all events
- `provider.queryFilter(filter, fromBlock, toBlock)` becomes performant
- Essential for Phase 2 event listener on backend

---

## 9. Refund Logic — Deferred, Justified

**Decision: Defer refunds to post-hackathon.**

**Justification:**

1. **Correctness risk is highest here.** A bug in a refund function literally loses investor funds. No amount of testing in a 48-hour hackathon provides the confidence needed.

2. **MVP demo goal doesn't require it.** The demo shows: register → create campaign → invest → milestone release. Refund is not in the judging flow.

3. **The data is already there.** `investments[campaignKey][investor]` is recorded on-chain for every investor. Adding refund logic later is a function-add to an existing mapping — no state migration required.

4. **Polygon testnet.** No real funds at risk. Investors understand this is a testnet demo.

5. **UX alternative.** Display a banner: *"Refund policy governed by platform terms. On-chain refunds coming in v1.1."* This is honest and acceptable for a demo.

**What the refund function would look like (design only, not implemented):**
```
function refundInvestor(bytes32 campaignKey) external {
    // require: campaign.isOpen == false (cancelled or failed)
    // require: block.timestamp > deadline + grace period
    // amount = investments[campaignKey][msg.sender]
    // require: amount > 0
    // investments[campaignKey][msg.sender] = 0
    // transfer(amount → msg.sender)
    // emit InvestmentRefunded(...)
}
```

---

## 10. Exact Function List (MVP Contract)

```
// ─── Admin functions (onlyOwner) ─────────────────────────────────────────────

function createCampaign(
    bytes32        campaignKey,
    address        startupWallet,
    uint256        fundingGoal,
    uint256        deadline,
    uint8          milestoneCount,
    uint8[] calldata milestonePercentages
) external onlyOwner;

function releaseMilestone(
    bytes32 campaignKey,
    uint8   milestoneIndex
) external onlyOwner;

function setCampaignOpen(
    bytes32 campaignKey,
    bool    isOpen
) external onlyOwner;
// Used for: pausing, closing after deadline, cancellation path

// ─── Investor functions (public) ──────────────────────────────────────────────

function invest(
    bytes32 campaignKey
) external payable;

// ─── View functions (free) ────────────────────────────────────────────────────

function getCampaign(bytes32 campaignKey)
    external view
    returns (Campaign memory);

function getInvestment(bytes32 campaignKey, address investor)
    external view
    returns (uint256 amount);

function getTotalRaised(bytes32 campaignKey)
    external view
    returns (uint256);
```

**Total: 7 functions.** Minimal and auditable.

---

## 11. Recommended Contract Data Structure

```
// Storage layout

address public owner;

mapping(bytes32 => Campaign) public campaigns;

mapping(bytes32 => mapping(address => uint256)) public investments;
// investments[campaignKey][investorAddress] = weiAmount

struct Campaign {
    address  startupWallet;
    uint256  fundingGoal;
    uint256  deadline;
    uint256  totalRaised;
    uint8    milestoneCount;
    uint8    currentMilestoneIndex;
    uint8[5] milestonePercentages;   // indices 0–4
    bool     exists;
    bool     isOpen;
}
```

**Storage packing note (gas optimization):**
- `milestoneCount` (uint8) + `currentMilestoneIndex` (uint8) + `milestonePercentages` (5 × uint8) + `exists` (bool) + `isOpen` (bool) = 9 bytes — fits in a single 32-byte storage slot
- `address startupWallet` = 20 bytes in its own slot (or packed with other small types)
- Solidity packs adjacent smaller types automatically in the order declared

---

## 12. Gas Cost Considerations (Polygon Mumbai)

| Operation | Estimated Gas | MATIC cost (10 gwei) |
|---|---|---|
| `createCampaign` | ~120,000 | ~0.0012 MATIC |
| `invest` | ~60,000 | ~0.0006 MATIC |
| `releaseMilestone` | ~50,000 | ~0.0005 MATIC |
| Contract deployment | ~800,000 | ~0.008 MATIC |

**Polygon testnet MATIC is free.** Gas is not a real concern for the hackathon. Optimization is for good engineering hygiene only.

**Key gas decisions made:**
- `bytes32` key instead of `string`: saves ~2,000 gas per function call (no dynamic encoding)
- `uint8[5]` instead of `uint256[]`: saves ~5 storage slots per campaign
- No per-investor mapping inside struct (separate top-level mapping): avoids quadratic storage growth
- No on-chain string storage (names, descriptions): avoids enormous SSTORE costs
- `calldata` for array params in external functions: 30% cheaper than `memory`

---

## 13. Backend Pre-Call Verification Checklist

Before calling any contract function, the backend must verify the database state. The contract is not a validator — it is a trusted executor.

### Before `createCampaign`
- [ ] Campaign exists in MongoDB with `status: 'active'`
- [ ] Campaign has no `campaignKey` yet (`campaignKey: null`)
- [ ] `milestonePercentages` sum to 100
- [ ] `milestoneCount` matches `milestonePercentages.length`
- [ ] `deadline` is in the future
- [ ] `startupWallet` (user.walletAddress) is set and valid (`0x` + 40 hex chars)
- [ ] Startup profile exists and is associated with this campaign

### Before `invest` (frontend verification — backend verifies after)
- [ ] Campaign exists in MongoDB with `status: 'active'`
- [ ] `isContractDeployed: true`
- [ ] Campaign deadline has not passed
- [ ] Investment amount >= `campaign.minInvestment`
- [ ] Investment amount <= `campaign.maxInvestment` (if set)

### Before `releaseMilestone` (backend signer)
- [ ] Milestone exists in MongoDB with `status: 'approved'`
- [ ] Milestone `index === campaign.currentMilestoneIndex` in MongoDB
- [ ] Campaign `isContractDeployed: true`
- [ ] Campaign has a valid `campaignKey`
- [ ] Campaign `status` is `'active'` or `'funded'`

### After `invest` tx confirmed (backend records)
- [ ] Call `provider.getTransactionReceipt(txHash)`
- [ ] Verify receipt has `status: 1` (success)
- [ ] Verify `to` address matches the known contract address
- [ ] Decode `InvestmentReceived` event from receipt logs
- [ ] Write investment record to MongoDB with `txHash`

### After `releaseMilestone` tx confirmed
- [ ] Decode `MilestoneReleased` event from receipt
- [ ] Set `milestone.releaseTxHash`, `releasedAmount`, `releasedAt` in MongoDB
- [ ] Set `milestone.status: 'released'`
- [ ] Advance `campaign.currentMilestoneIndex` in MongoDB
- [ ] If final milestone: set `campaign.status: 'completed'`

---

## 14. Alignment with Current Backend Models

| MongoDB Field | Contract Equivalent | Notes |
|---|---|---|
| `campaign.campaignKey` | `bytes32` mapping key | Generated by backend, stored in both |
| `campaign.fundingGoal` | `campaign.fundingGoal` | In MATIC (DB) vs wei (contract) — convert on write |
| `campaign.milestonePercentages` | `campaign.milestonePercentages[5]` | Validated to sum to 100 in both |
| `campaign.milestoneCount` | `campaign.milestoneCount` | Must match array length |
| `campaign.currentMilestoneIndex` | `campaign.currentMilestoneIndex` | Both updated on release |
| `campaign.currentRaised` | `campaign.totalRaised` | MongoDB is cache; contract is truth |
| `campaign.contractAddress` | N/A (single contract) | Stored once, same for all campaigns |
| `campaign.isContractDeployed` | Inferred from `campaigns[key].exists` | Flag for backend routing |
| `milestone.releaseTxHash` | Emitted in `MilestoneReleased` event | Read from receipt, stored in DB |
| `milestone.releasedAmount` | `releaseAmount` in event | Read from receipt |
| `investment.txHash` | Emitted in `InvestmentReceived` event | Frontend sends, backend verifies |
| `user.walletAddress` | `investor` / `startupWallet` | Validated format before use |

**MATIC ↔ Wei conversion rule:**
- All on-chain values are in wei (`1 MATIC = 10^18 wei`)
- MongoDB stores human-readable MATIC values (e.g., `50.0`)
- Backend converts: `ethers.parseEther(campaign.fundingGoal.toString())`
- Never pass raw MongoDB numbers to the contract without conversion

---

## Summary: What Gets Built Next

```
Phase 2 implementation plan:

1. Hardhat project setup (d:\Enigma\contracts\)
2. Write InvestmentPlatform.sol (7 functions, 2 events + 2 more)
3. Write Hardhat tests (createCampaign, invest, releaseMilestone)
4. Deploy to Polygon Mumbai → save contract address to .env
5. Backend: add ethers.js provider + signer to src/config/blockchain.js
6. Backend: add activateCampaign service (createCampaign on-chain)
7. Backend: replace releaseMilestone stub with real contract call
8. Backend: add POST /api/v1/investments endpoint (verify + record)
9. Frontend: wallet connect (wagmi/ethers) + invest flow
```
