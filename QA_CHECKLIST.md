# Enigma Invest — Local QA Checklist

> **UPDATED FOR LOCAL QA PREP**
> Last updated: April 2026 · Architecture: MERN + Razorpay (off-chain payments) + Blockchain transparency layer

---

## Quick-start (TL;DR)

```bash
# 1. Backend
cd backend
cp .env.example .env/.env   # fill MONGO_URI + JWT_SECRET at minimum
npm install
npm run seed                 # one-time data seeding
npm run dev

# 2. Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

**Test accounts (created by seed):**

| Role     | Email               | Password    |
|----------|---------------------|-------------|
| admin    | admin@test.com      | Pass1234 |
| startup  | startup@test.com    | Pass1234 |
| investor | investor@test.com   | Pass1234 |

---

## 1. Environment Setup

### 1.1 Backend `.env`

The env file must live at `backend/.env/.env` (not `backend/.env`).

```bash
mkdir -p backend/.env
cp backend/.env.example backend/.env/.env
```

**Minimum required vars for local QA (no Razorpay, no blockchain):**

```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb+srv://...   # your Atlas URI
JWT_SECRET=some_long_random_string_at_least_32_chars
JWT_EXPIRE=7d
FRONTEND_URL=http://localhost:5173

# Dev bypass flags (enables full flow without external services)
DEV_BYPASS_PAYMENT=true
DEV_SKIP_BLOCKCHAIN=true
```

### 1.2 Verify server starts cleanly

After `npm run dev`, confirm the startup banner shows:

```
[SERVER] Running in development mode on port 5000
[CONFIG] ─────────────────────────────────────────
[CONFIG] Razorpay configured   : ⚠️  no  (DEV_BYPASS_PAYMENT required to test payments)
[CONFIG] Blockchain configured : ⚠️  no  (transparency logging will degrade gracefully)
[CONFIG] DEV_BYPASS_PAYMENT    : 🚧 ON  ← dev only, never use in prod
[CONFIG] DEV_SKIP_BLOCKCHAIN   : 🚧 ON  ← dev only, never use in prod
[CONFIG] ─────────────────────────────────────────
```

### 1.3 Health check

```bash
curl http://localhost:5000/api/v1/health
# Expected: { "success": true, "message": "Enigma Invest API is running" }
```

---

## 2. Seed Data

Run once (idempotent — safe to re-run):

```bash
cd backend
npm run seed
```

Expected output:
```
✅ Admin user created        → admin@test.com / Pass1234
✅ Startup user created      → startup@test.com / Pass1234
✅ Investor user created     → investor@test.com / Pass1234
✅ Startup profile created   → Acme Robotics (verified)
✅ Campaign created          → Acme Series A (active, 2 milestones)
✅ Milestones created        → #0 disbursed, #1 pending
✅ Investment created        → investor@test.com → ₹1,000 → Acme Series A
```

**Seeded state summary:**
- Campaign `Acme Series A` is **active**, raising ₹50,000
- Milestone 0 (`Procure Manufacturing Tooling`) → **disbursed**
- Milestone 1 (`Marketing Launch`) → **pending** (startup must submit proof)
- 1 confirmed investment from investor@test.com (₹1,000)

---

## 3. Authentication Flows

### 3.1 Login as admin
```bash
POST http://localhost:5000/api/v1/auth/login
{ "email": "admin@test.com", "password": "Pass1234" }
```
Save the JWT (`token`) for admin requests.

### 3.2 Login as startup
```bash
POST http://localhost:5000/api/v1/auth/login
{ "email": "startup@test.com", "password": "Pass1234" }
```

### 3.3 Login as investor
```bash
POST http://localhost:5000/api/v1/auth/login
{ "email": "investor@test.com", "password": "Pass1234" }
```

**Verify role protection:**
- Try accessing `POST /api/v1/campaigns/:id/milestones/:id/approve` with investor JWT → expect `403 Forbidden`
- Try accessing `POST /api/v1/payments/create-order` without JWT → expect `401 Unauthorized`

---

## 4. Investment Flow (with DEV_BYPASS_PAYMENT=true)

This simulates the full Razorpay invest flow without real money.

### Step 1 — Get campaign ID
```bash
GET http://localhost:5000/api/v1/campaigns
# Find "Acme Series A" → copy its _id
```

### Step 2 — Create fake order (as investor)
```bash
POST http://localhost:5000/api/v1/payments/create-order
Authorization: Bearer <investor_token>
{
  "campaignId": "<campaign_id>",
  "amount": 1000
}
```
Expected response:
```json
{
  "orderId": "dev_order_1713..._abc123",
  "amount": 100000,
  "currency": "INR",
  "key": "rzp_test_dev_fake",
  "_devMode": true
}
```

### Step 3 — Verify payment (as investor)
```bash
POST http://localhost:5000/api/v1/payments/verify
Authorization: Bearer <investor_token>
{
  "campaignId": "<campaign_id>",
  "amount": 1000,
  "razorpay_order_id": "dev_order_1713..._abc123",
  "razorpay_payment_id": "pay_devtest_001",
  "razorpay_signature": "any_value_bypassed"
}
```
Expected: `201` with investment record, `blockchainStatus: "logged"` (from mock tx).

### Step 4 — Verify campaign totals updated
```bash
GET http://localhost:5000/api/v1/campaigns/<campaign_id>
# currentRaised should have increased by 1000
```

---

## 5. Duplicate Investment Prevention

Attempt to reuse the same `razorpay_order_id` from Step 2:
```bash
POST http://localhost:5000/api/v1/payments/verify
# (same body as Step 3)
```
Expected: `409 Conflict — Order has already been recorded.`

---

## 6. Milestone Flow

Find the seeded campaign's milestone IDs:
```bash
GET http://localhost:5000/api/v1/campaigns/<campaign_id>/milestones
```

You'll see:
- Milestone index 0 → status: `disbursed`
- Milestone index 1 → status: `pending`  ← the active one (currentMilestoneIndex=1)

### 6.1 Startup submits proof (milestone index 1)
```bash
PATCH http://localhost:5000/api/v1/campaigns/<campaign_id>/milestones/<milestone_1_id>/submit
Authorization: Bearer <startup_token>
{
  "description": "Marketing campaign launched on April 14. 52,000 impressions in week 1. Google Ads spend: ₹8,000.",
  "proofLinks": ["https://datastudio.google.com/dev-report"],
  "documents": []
}
```
Expected: `200` with status → `submitted`

### 6.2 Try submitting out of order (should fail)
Get milestone index 0's ID (already disbursed) and try to submit it:
```bash
PATCH .../milestones/<milestone_0_id>/submit
```
Expected: `400 — Milestone is currently "disbursed". Proof can only be submitted when status is "pending" or "rejected".`

### 6.3 Admin approves
```bash
PATCH http://localhost:5000/api/v1/campaigns/<campaign_id>/milestones/<milestone_1_id>/approve
Authorization: Bearer <admin_token>
{}
```
Expected: `200` with status → `approved`

### 6.4 Admin rejects (alternative path — do this instead of 6.3 to test rejection)
```bash
PATCH http://localhost:5000/api/v1/campaigns/<campaign_id>/milestones/<milestone_1_id>/reject
Authorization: Bearer <admin_token>
{ "rejectionReason": "Google Ads screenshot missing. Resubmit with full dashboard export." }
```
Expected: `200` status → `rejected`

Then startup resubmits (same endpoint as 6.1) — should succeed.

### 6.5 Admin disburses (after approval)
```bash
PATCH http://localhost:5000/api/v1/campaigns/<campaign_id>/milestones/<milestone_1_id>/disburse
Authorization: Bearer <admin_token>
{
  "disbursalReference": "IMPS-2024-TEST-002",
  "disbursalNote": "QA test disbursal"
}
```
Expected: `200` — status → `disbursed`, campaign `currentMilestoneIndex` advances, campaign status → `completed` (since this is the last milestone).

---

## 7. Blockchain Failure Isolation

Test that a blockchain failure does NOT break the investment record.

### Scenario A — Mock blockchain (DEV_SKIP_BLOCKCHAIN=true)
Payment verifies and investment is saved. Response includes:
```json
"blockchain": { "status": "logged", "txHash": "mock_tx_...", "blockNumber": 999999 }
```

### Scenario B — Blockchain degraded (set DEV_SKIP_BLOCKCHAIN=false, no RPC configured)
Remove `DEV_SKIP_BLOCKCHAIN` from env and restart. Make a new payment.
Response should still be `201` but with:
```json
"blockchain": { "status": "failed", "error": "Blockchain transparency layer configs missing..." }
```
The investment record is saved, `blockchainStatus: "failed"` is written. No crash.

---

## 8. Investor History & Audit

### 8.1 Investor's investments
```bash
GET http://localhost:5000/api/v1/investments/my
Authorization: Bearer <investor_token>
```
Should list the seeded investment + any new ones.

### 8.2 Campaign investments (startup view)
```bash
GET http://localhost:5000/api/v1/investments/campaign/<campaign_id>
Authorization: Bearer <startup_token>
```

### 8.3 Admin investment view
```bash
GET http://localhost:5000/api/v1/investments
Authorization: Bearer <admin_token>
```

---

## 9. Frontend Smoke Tests

After `npm run dev` in the frontend directory:

1. **Discover page** — Opens at `http://localhost:5173` (or `:3000`)
   - [ ] Campaign cards visible (Acme Series A should appear)
   - [ ] Click campaign card → opens campaign detail page
   - [ ] Investment limits shown correctly (min ₹500, max ₹10,000)

2. **Login flow**
   - [ ] Login as investor → redirected to investor dashboard
   - [ ] Login as startup → redirected to startup dashboard
   - [ ] Login as admin → redirected to admin panel

3. **Invest flow** (frontend with DEV_BYPASS_PAYMENT=true)
   - [ ] Enter ₹1,000 → click Invest
   - [ ] Order created (fake), Razorpay modal may appear or skip depending on frontend impl
   - [ ] Investment confirmed → success toast/page

4. **Milestone dashboard** (as startup)
   - [ ] Milestone 0 shows `Disbursed` badge
   - [ ] Milestone 1 shows `Pending` with "Submit Proof" button

5. **Admin milestone queue** (as admin)
   - [ ] Submitted milestones visible
   - [ ] Approve / Reject buttons functional

---

## 10. Known Local QA Limitations

| Limitation | Workaround |
|---|---|
| Real Razorpay UX (modal, OTP) not triggered | `DEV_BYPASS_PAYMENT=true` simulates the verify step |
| No real blockchain tx | `DEV_SKIP_BLOCKCHAIN=true` returns mock tx hash |
| Email notifications not sent | Expected — no mailer configured for QA |
| MongoDB Atlas DNS errors on first boot | Transient — restart backend or check internet |

---

## 11. Resetting Seed Data

To wipe seeded data and re-seed clean:

```bash
# In MongoDB Atlas or mongosh — drop the collections:
db.users.deleteMany({ email: { $in: ["admin@test.com","startup@test.com","investor@test.com"] } })
db.startupprofiles.deleteMany({ startupName: "Acme Robotics" })
db.campaigns.deleteMany({ title: "Acme Series A" })
db.milestones.deleteMany({})
db.investments.deleteMany({ paymentOrderId: "dev_seed_order_001" })

# Then re-run:
npm run seed
```
