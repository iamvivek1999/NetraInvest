# Campaign Creation Flow — Walkthrough

## Files Created / Modified

| File | Status |
|------|--------|
| `frontend/src/api/campaigns.api.js` | ✅ NEW |
| `frontend/src/api/milestones.api.js` | ✅ NEW |
| `frontend/src/pages/dashboard/CreateCampaign.jsx` | ✅ NEW |
| `frontend/src/pages/dashboard/StartupDashboard.jsx` | ✅ MODIFIED |
| `frontend/src/App.jsx` | ✅ MODIFIED |
| `frontend/vite.config.js` | ✅ MODIFIED |
| `frontend/src/utils/constants.js` | ✅ MODIFIED |

---

## Backend Endpoints Used

| Step | Method | URL | Role |
|------|--------|-----|------|
| Create campaign | `POST` | `/api/v1/campaigns` | startup |
| Batch create milestones | `POST` | `/api/v1/campaigns/:id/milestones` | startup |
| List own campaigns | `GET` | `/api/v1/campaigns/my` | startup |

### Create Campaign Payload
```json
{
  "title": "My Campaign",
  "summary": "30–500 char description...",
  "fundingGoal": 50000,
  "currency": "MATIC",
  "minInvestment": 10,
  "deadline": "2025-09-01T00:00:00.000Z",
  "milestoneCount": 3,
  "milestonePercentages": [34, 33, 33],
  "tags": ["blockchain", "polygon"]
}
```

### Create Milestones Payload
```json
{
  "milestones": [
    { "title": "MVP Launch", "description": "Build and ship the MVP..." },
    { "title": "Pilot", "description": "Onboard 10 SMB partners..." },
    { "title": "Public Launch", "description": "Market campaign targeting 500+ SMBs..." }
  ]
}
```

> [!IMPORTANT]
> `milestones` array length must **exactly match** `milestoneCount`. The backend enforces this at the API layer.

---

## Two-Step Form State Structure

```js
// Step 1 — details
const [details, setDetails] = useState({
  title:          '',      // string, max 120 chars
  summary:        '',      // string, 30–500 chars
  fundingGoal:    '',      // numeric string → parseFloat on submit
  currency:       'MATIC', // 'MATIC' | 'ETH'
  minInvestment:  '1',     // numeric string, default 1
  maxInvestment:  '',      // optional
  deadline:       '',      // YYYY-MM-DD (date input)
  milestoneCount: 3,       // 1–5 (button selector)
  tags:           '',      // comma-separated → split on submit
});

// Step 1 — percentages (auto-distributed, user-adjustable sliders)
const [percentages, setPercentages] = useState([34, 33, 33]);
// distributeEvenly(n) fills evenly, remainder goes to last element

// Step 2 — one entry per milestone
const [milestones, setMilestones] = useState([
  { title: '', description: '', targetDate: '' },
  { title: '', description: '', targetDate: '' },
  { title: '', description: '', targetDate: '' },
]);
```

---

## Validation Rules (mirrors backend)

| Field | Rule |
|-------|------|
| `title` | Required, max 120 chars |
| `summary` | Required, 30–500 chars |
| `fundingGoal` | Required, > 0 |
| `minInvestment` | Optional, > 0 |
| `maxInvestment` | Optional, > minInvestment, ≤ fundingGoal |
| `deadline` | Required, at least 24h in the future |
| `milestoneCount` | Required, 1–5 |
| `milestonePercentages` | Must sum to **exactly 100** |
| Milestone `title` | Required per milestone (Step 2) |
| Milestone `description` | Required per milestone (Step 2) |

---

## How to Run End-to-End

> [!IMPORTANT]
> Both servers must be running from **your machine** (Atlas IP whitelist allows your IP).

### 1. Start backend
```bash
cd d:\Enigma\backend
npm run dev
# Should print: Server running on port 5000 + MongoDB connected
```

### 2. Start frontend
```bash
cd d:\Enigma\frontend
npm run dev
# Opens http://localhost:3000
# strictPort: true — will Error if 3000 is taken (kill the old process first)
```

> [!TIP]
> All API calls now go through Vite's proxy (`/api/v1` → `http://localhost:5000/api/v1`).  
> This **eliminates CORS entirely** in development. No CORS headers needed on backend for frontend calls.

### 3. Login as Alice Chen (startup)
- Go to `http://localhost:3000/login`
- Email: `alicechen@enigmatest.dev` / Password: `Test1234`
- Redirected to `/dashboard`

### 4. Create Campaign
- Click **"＋ New Campaign"** in the dashboard card or sidebar
- URL: `http://localhost:3000/dashboard/campaigns/new`

**Step 1:**
- Fill title, summary (30+ chars), funding goal, deadline (future date)
- Click milestone count buttons (1–5) — percentages auto-distribute
- Drag sliders or type values to adjust percentages (Total badge turns green when = 100%)
- Click **"Continue to Milestones →"**

**Step 2:**
- Summary banner shows campaign metadata
- Fill title + description for each milestone
- Click **"🚀 Create Campaign"**

### 5. Verify on Dashboard
- Toast: `"🚀 Campaign created successfully!"`
- Redirect to `/dashboard`
- Campaign card appears with **Draft** status badge
- Stats update: Campaigns = 1
- Pending Actions: shows draft warning

---

## Key Architecture Notes

### Proxy replaces direct CORS
```
Browser → localhost:3000/api/v1/campaigns
         ↓ Vite proxy
         → localhost:5000/api/v1/campaigns
```
No `Authorization` header CORS issues — same origin from browser's perspective.

### Percentage distribution
```js
distributeEvenly(3) → [34, 33, 33]  // sum = 100
distributeEvenly(4) → [25, 25, 25, 25]
distributeEvenly(5) → [20, 20, 20, 20, 20]
```
Remainder always goes to the last element. User can drag sliders to adjust.

### Two-call submit flow
```js
// 1. Create the campaign record
const campaign = await createCampaign(payload);

// 2. Batch-create milestones (uses campaign._id)
await createMilestones(campaign._id, milestonesPayload);

// If step 2 fails: campaign exists as draft, user is redirected to dashboard
// with a warning toast — they can see the draft and retry
```

---

## What's Next (Not Built Yet)

| Feature | Phase |
|---------|-------|
| Blockchain activation (`POST /campaigns/:id/activate`) | Phase 2 |
| Wallet connect + MetaMask flow | Phase 2 |
| Milestone submit/approve/reject/release UI | Admin phase |
| Campaign detail page (full investor view) | Next sprint |
| Investor invest flow (MetaMask + POST /investments) | Next sprint |
