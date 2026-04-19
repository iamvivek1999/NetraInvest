# Enigma Platform — Operations Runbook

> **Version**: Phase 12 (End-to-End Integration)  
> **Last Updated**: April 2026  
> **Stack**: Node.js 18+, Express, MongoDB, Ethers v6, Hardhat, Polygon Amoy  

---

## Table of Contents

1. [Environment Variables](#1-environment-variables)
2. [Local Development Setup](#2-local-development-setup)
3. [Contract Deployment](#3-contract-deployment)
4. [ABI Sync Procedure](#4-abi-sync-procedure)
5. [Running Tests](#5-running-tests)
6. [Database Migration](#6-database-migration)
7. [Seeding Dev Data](#7-seeding-dev-data)
8. [End-to-End Verification Checklist](#8-end-to-end-verification-checklist)
9. [Architecture Overview](#9-architecture-overview)
10. [Known Limitations & Future Work](#10-known-limitations--future-work)

---

## 1. Environment Variables

### `backend/.env/.env`

| Variable | Required | Description | Example |
|---|---|---|---|
| `PORT` | ✅ | Backend server port | `5000` |
| `MONGO_URI` | ✅ | MongoDB connection string | `mongodb://localhost:27017/enigma` |
| `JWT_SECRET` | ✅ | JWT signing secret (min 32 chars) | `super-secret-key-change-in-prod` |
| `JWT_EXPIRE` | Production | JWT expiry duration | `7d` |
| `FRONTEND_URL` | Production | Allowed CORS origin | `https://app.enigmainvest.io` |
| `ALCHEMY_RPC_URL` | Blockchain | JSON-RPC endpoint | `https://polygon-amoy.g.alchemy.com/v2/YOUR_KEY` |
| `CONTRACT_ADDRESS` | Blockchain | Deployed contract address | `0xAbCd...` |
| `ADMIN_WALLET_PRIVATE_KEY` | Blockchain | Campaign creation signer | `0x...` |
| `OPERATOR_WALLET_PRIVATE_KEY` | Optional | Evidence anchoring signer (fallback: ADMIN) | `0x...` |
| `REVIEWER_WALLET_PRIVATE_KEY` | Optional | Milestone approval/release signer (fallback: ADMIN) | `0x...` |
| `EVIDENCE_STORAGE_ROOT` | Optional | Absolute path for uploaded files | `/var/enigma/uploads` |
| `DEV_STUB_BLOCKCHAIN_MODE` | Dev only | Skip all on-chain verification | `true` |
| `NODE_ENV` | Optional | `development` or `production` | `development` |
| `ADMIN_EMAIL` | Optional | Admin user seed email | `admin@enigmainvest.dev` |
| `ADMIN_PASSWORD` | Optional | Admin user seed password | `Admin@1234` |

> ⚠️ **Never commit `.env` files.** They are excluded via `.gitignore`.

### `contracts/.env`

| Variable | Required | Description |
|---|---|---|
| `ADMIN_PRIVATE_KEY` | Deployment | Deployer / DEFAULT_ADMIN_ROLE |
| `OPERATOR_PRIVATE_KEY` | Optional | Auto-grants OPERATOR_ROLE on deploy |
| `REVIEWER_PRIVATE_KEY` | Optional | Auto-grants REVIEWER_ROLE on deploy |
| `ALCHEMY_RPC_URL` | Amoy deploy | Amoy testnet RPC URL |
| `POLYGONSCAN_API_KEY` | Optional | For `hardhat verify` |
| `OPERATOR_ADDRESS` | Optional | Explicit address override for OPERATOR_ROLE |
| `REVIEWER_ADDRESS` | Optional | Explicit address override for REVIEWER_ROLE |

---

## 2. Local Development Setup

```bash
# 1. Start MongoDB (if not using cloud Atlas)
mongod --dbpath ./data/db

# 2. Start backend
cd backend
cp .env/.env.example .env/.env   # fill in variables
npm install
npm run dev                       # starts on PORT=5000

# 3. Start frontend
cd frontend
npm install
npm run dev                       # starts on localhost:5173

# 4. Start local Hardhat node (in separate terminal)
cd contracts
npx hardhat node                  # starts on http://127.0.0.1:8545

# 5. Deploy contract to local node
npx hardhat run scripts/deploy.js --network localhost
# → Copy CONTRACT_ADDRESS from output, paste into backend/.env/.env

# 6. Sync ABI
cd backend
npm run sync:abi

# 7. Seed development data
npm run seed:web3
```

---

## 3. Contract Deployment

### Local Hardhat (no keys needed — uses Hardhat's built-in accounts)

```bash
cd contracts
npx hardhat run scripts/deploy.js --network hardhat
```

### Polygon Amoy Testnet

> **Prerequisites**: Fund your deployer wallet with testnet POL from [Polygon Faucet](https://faucet.polygon.technology/).

```bash
cd contracts

# Set in contracts/.env:
#   ADMIN_PRIVATE_KEY=0x...
#   OPERATOR_PRIVATE_KEY=0x...    (optional)
#   REVIEWER_PRIVATE_KEY=0x...    (optional)
#   ALCHEMY_RPC_URL=https://polygon-amoy.g.alchemy.com/v2/YOUR_KEY

npx hardhat run scripts/deploy.js --network amoy
```

The script will:
1. Deploy `InvestmentPlatform.sol`
2. Auto-grant `OPERATOR_ROLE` (if `OPERATOR_PRIVATE_KEY` or `OPERATOR_ADDRESS` is set)
3. Auto-grant `REVIEWER_ROLE` (if `REVIEWER_PRIVATE_KEY` or `REVIEWER_ADDRESS` is set)
4. Print the new `CONTRACT_ADDRESS` for your `.env` files

### Optional: Verify on Polygonscan

```bash
cd contracts
npx hardhat verify --network amoy <CONTRACT_ADDRESS>
```

---

## 4. ABI Sync Procedure

After every contract redeployment, the backend must use the latest ABI:

```bash
cd backend
npm run sync:abi
```

This copies the compiled ABI from `contracts/artifacts/contracts/InvestmentPlatform.sol/InvestmentPlatform.json` to `backend/src/config/abi/InvestmentPlatform.json`.

> ⚠️ **If you skip this step**, the backend will use a stale ABI and contract calls will fail silently or with encoding errors.

---

## 5. Running Tests

### Hardhat Contract Tests (Solidity)

```bash
cd contracts
npx hardhat test                    # all tests
npx hardhat test test/InvestmentPlatform.test.js         # main lifecycle
npx hardhat test test/InvestmentPlatform.RBAC.test.js    # role-based access control
npx hardhat test --grep "double release"                 # filter by test name
REPORT_GAS=true npx hardhat test                         # with gas report
npx hardhat coverage                                     # coverage report
```

### Backend Integration Tests (Jest)

```bash
cd backend
npm test                    # all suites, sequential
npm run test:verbose        # verbose output
npm run test:coverage       # with Istanbul coverage
npm run test:watch          # watch mode for development
```

**Individual suites:**
```bash
npx jest src/tests/integration/txVerification.test.js
npx jest src/tests/integration/investment.controller.test.js
npx jest src/tests/integration/milestoneEvidence.controller.test.js
npx jest src/tests/integration/blockchainSync.test.js
```

### Concurrency Test (Race Condition Validation)

```bash
cd backend
node scripts/test-concurrency.js
```

Expected output:
```
✅ First release: 200 OK
✅ Second release: 409 Conflict
✅ Atomic lock working correctly — no double spend!
```

---

## 6. Database Migration

Run **before** starting the server in production after a major schema change:

```bash
cd backend

# Dry-run first (no writes) — see what would change
npm run migrate:dry

# Execute migration
npm run migrate
```

**Migrations performed** (idempotent — safe to re-run):
1. `Investment.syncStatus` backfill from old `status` field
2. `Investment.blockchainStatus` → moved to `verificationNote`
3. Razorpay investments reclassified as `sourceOfTruth: 'local'`
4. `EvidenceBundle.onChainStatus: null` → `'processed'`
5. `Campaign.totalRaisedWei` backfill from numeric `currentRaised` (POL campaigns)

---

## 7. Seeding Dev Data

### Legacy seed (Razorpay-era, INR investments)
```bash
cd backend
npm run seed
```

### Web3-native seed (recommended for Phase 12+)
```bash
cd backend
npm run seed:web3
```

**Creates**: admin, startup (NovaTech AI), investor, campaign with campaignKey, 2 milestones, 1.5 POL investment (confirmed), 1 EvidenceBundle (anchored — ready for admin approval).

**Override env vars** for custom seed:
```bash
WEB3_SEED_CAMPAIGN_KEY=0x123...    # use specific bytes32 campaign key
WEB3_SEED_TX_HASH=0xabc...         # use specific investment txHash
WEB3_SEED_INVESTOR_WALLET=0xdef... # use specific investor wallet
```

---

## 8. End-to-End Verification Checklist

Run this checklist after each deployment to verify the full workflow:

### Backend API
- [ ] `GET /api/v1/health` → `{ status: 'ok' }`
- [ ] `POST /api/v1/auth/login` (admin@enigma.dev) → JWT returned
- [ ] `GET /api/v1/campaigns` → list includes seeded campaign
- [ ] `GET /api/v1/campaigns/:id` → shows campaignKey and milestones

### Investment Flow
- [ ] Login as investor → get JWT
- [ ] `POST /api/v1/investments` with stub mode (DEV_STUB_BLOCKCHAIN_MODE=true) → 201
- [ ] Retry same txHash → 200 idempotent (not 409)
- [ ] Invalid txHash format → 400
- [ ] Non-existent campaign → 404
- [ ] `GET /api/v1/investments/my` → returns investments with summary

### Blockchain (Requires Running Node + Deployed Contract)
- [ ] Deploy contract → `CONTRACT_ADDRESS` printed
- [ ] `npm run sync:abi` → backend/src/config/abi/InvestmentPlatform.json updated
- [ ] Real invest() tx via MetaMask → receipt received → `POST /api/v1/investments` with txHash → 201 confirmed
- [ ] Sync service reconciliation → verifies existing chain events

### Milestone Evidence Flow
- [ ] Upload milestone evidence (startup role) → EvidenceBundle created
- [ ] Admin anchors evidence on-chain → submitTxHash stored, status: anchored
- [ ] Admin approves → status: approved
- [ ] Admin releases → status: released, releaseTxHash stored
- [ ] Second release attempt → **409 Conflict** (atomic lock)

### Security
- [ ] Unauthenticated request → 401
- [ ] Investor attempts release → 403
- [ ] Startup attempts release → 403
- [ ] `POST /api/v1/payments-legacy/anything` → 410 Gone

### Migration
- [ ] `npm run migrate:dry` completes without errors
- [ ] `npm run migrate` reports 0 documents modified (fresh seed)

---

## 9. Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                  Enigma Platform                     │
├──────────────┬──────────────┬───────────────────────┤
│   Frontend   │   Backend    │   Smart Contract       │
│  (React/Vite)│  (Express)   │  (InvestmentPlatform) │
│              │              │                        │
│  MetaMask    │  MongoDB     │  AccessControl Roles:  │
│  ethers v6   │  JWT Auth    │  - DEFAULT_ADMIN_ROLE  │
│  Web3 hooks  │  RBAC APIs   │  - OPERATOR_ROLE       │
│              │  Blockchain  │  - REVIEWER_ROLE       │
│              │  Sync Svc    │                        │
└──────────────┴──────────────┴───────────────────────┘
```

**Role separation**:
| Role | Wallet | Can Do |
|---|---|---|
| `DEFAULT_ADMIN_ROLE` | `ADMIN_WALLET_PRIVATE_KEY` | createCampaign, pauseCampaign, cancelCampaign, grantRole |
| `OPERATOR_ROLE` | `OPERATOR_WALLET_PRIVATE_KEY` | submitMilestoneEvidenceHash |
| `REVIEWER_ROLE` | `REVIEWER_WALLET_PRIVATE_KEY` | approveMilestoneEvidence, releaseMilestone |
| Investor EOA | User's MetaMask | invest() |

---

## 10. Known Limitations & Future Work

| Area | Current State | Future |
|---|---|---|
| File storage | Local filesystem (`EVIDENCE_STORAGE_ROOT`) | Migrate to IPFS / AWS S3 |
| Signer keys | In `.env` (plaintext) | AWS KMS / HashiCorp Vault |
| Admin role | Single wallet | Multisig (Gnosis Safe) |
| Frontend tests | Manual checklist only | Playwright E2E (MetaMask mock) |
| Notifications | In-memory + DB | WebSocket + email (SendGrid) |
| Chain support | Polygon Amoy (testnet) | Polygon Mainnet |
| Rate limiting | Single server (express-rate-limit) | Redis-backed distributed |

---

## Intervention Required from You

> **🔴 MANUAL ACTION NEEDED**

The following items require your credentials/keys before proceeding to Amoy testnet deployment:

1. **`ALCHEMY_RPC_URL`** — Create a free app at [alchemy.com](https://www.alchemy.com), select Polygon Amoy, copy the HTTPS URL
2. **`ADMIN_WALLET_PRIVATE_KEY`** — Fund a wallet with testnet POL from [Polygon Faucet](https://faucet.polygon.technology/)
3. **`OPERATOR_WALLET_PRIVATE_KEY`** — Separate wallet for evidence anchoring (can reuse admin for dev)
4. **`REVIEWER_WALLET_PRIVATE_KEY`** — Separate wallet for milestone approval (can reuse admin for dev)
5. **`POLYGONSCAN_API_KEY`** — Only needed for contract verification (`hardhat verify`)

Once you have these, add them to `contracts/.env` and `backend/.env/.env` then run:
```bash
cd contracts && npx hardhat run scripts/deploy.js --network amoy
cd backend   && npm run sync:abi
```
