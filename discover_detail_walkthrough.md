# Investor Discover & Campaign Detail — Walkthrough

## Files Modified

| File | Change |
|------|--------|
| `frontend/src/pages/Discover.jsx` | **REPLACED** — full live-data page |
| `frontend/src/pages/CampaignDetail.jsx` | **REPLACED** — full live-data page |
| `frontend/src/pages/Landing.jsx` | **MODIFIED** — featured section wired to real API |

---

## Backend Endpoints Used

| Action | Method | URL | Auth |
|--------|--------|-----|------|
| List active campaigns | `GET` | `/api/v1/campaigns?status=active&sortBy=...&search=...&limit=24` | Any auth |
| Featured campaigns (landing) | `GET` | `/api/v1/campaigns?status=active&limit=3&sortBy=raised` | Any auth |
| Single campaign | `GET` | `/api/v1/campaigns/:campaignId` | Any auth |
| Campaign milestones | `GET` | `/api/v1/campaigns/:campaignId/milestones` | Any auth |

### Campaign response shape (GET /campaigns/:id)
```json
{
  "_id": "...",
  "title": "...",
  "summary": "...",
  "fundingGoal": 100,
  "currentRaised": 0,
  "investorCount": 0,
  "minInvestment": 1,
  "deadline": "2027-03-12T00:00:00Z",
  "status": "active",
  "currency": "MATIC",
  "milestoneCount": 2,
  "currentMilestoneIndex": 0,
  "isContractDeployed": true,
  "contractAddress": "0x...",
  "tags": ["test"],
  "startupProfileId": {
    "startupName": "NexaChain Technologies",
    "tagline": "...",
    "industry": "Blockchain",
    "isVerified": false,
    "website": "https://...",
    "socialLinks": { "linkedin": "...", "twitter": "...", "github": "..." }
  },
  "userId": { "fullName": "Alice Chen" }
}
```

> [!IMPORTANT]
> Both `/campaigns` and `/campaigns/:id` require authentication (any role). The Discover and CampaignDetail routes are listed as "public" in the frontend router but the **backend enforces auth**. Unauthenticated visitors hitting these pages will get a 401, and React Query will surface an error state.

---

## Discover Page Features

| Feature | Implementation |
|---------|---------------|
| Live campaign cards | `useQuery` → `listCampaigns({ status: 'active', ... })` |
| Search | Debounced 500ms → `?search=` query param |
| Sort | Dropdown → `?sortBy=newest\|deadline\|raised\|goal` |
| Loading state | Skeleton grid (6 cards) |
| Empty state | 🔭 "No active campaigns yet" |
| Error state | ⚠️ Server error message |
| Tags on cards | First 3 tags shown as `#tag` badges |
| Startup name | `startupProfileId.startupName` + verified ✅ |
| Progress bar | `fundingPercent(currentRaised, fundingGoal)` |
| Days left | Warning color when ≤ 7 days |
| Pagination hint | Shows when `meta.pages > 1` |

---

## Campaign Detail Page Features

| Section | Content |
|---------|---------|
| Hero header | Title, status badge, industry, verified badge, on-chain badge, summary, tags |
| Startup byline | `by {startupName} · {tagline}` |
| About card | Summary + description + 6-cell meta grid |
| Milestone roadmap | Ordered list, current milestone highlighted with purple ring |
| Startup profile card | Logo initial, name, tagline, industry, website/social links |
| On-chain card | `contractAddress` + PolygonScan link (shown only if deployed) |
| **Right panel (sticky)** | Raised amount, progress bar, 4 stats (investors/days/minInvest/deadline) |
| Invest CTA states | Not logged in → "Log in to Invest" \| Startup role → "Only investors can fund" \| Active + investor → "🦊 Invest" button \| Closed → status badge |
| Loading | Full-page skeleton (no flash) |
| Error | Centered error card with "Back to Discover" |

---

## Landing Page Featured Section

- Fetches `GET /campaigns?status=active&limit=3&sortBy=raised`
- Section is **conditionally rendered** — hidden when `featured.length === 0`
- No error state shown (silent fail for unauthenticated visitors)
- Campaign cards link to real `/campaigns/:id` URLs

---

## How to Test End-to-End

### Prerequisites
```
Both servers running:
  cd d:\Enigma\backend  → npm run dev
  cd d:\Enigma\frontend → npm run dev
```

### 1. Get an active campaign (needed for full flow)
The "Test Campaign" in the DB is `draft` status. To see it on Discover it must be `active`.

**Option A — Activate via UI:**
Go to `/dashboard/campaigns/:id` → click "⚡ Activate Campaign"
(Requires blockchain env vars. Will fail with 502 without them.)

**Option B — Manually set via MongoDB (dev only):**
In Atlas or mongosh, run:
```js
db.campaigns.updateOne(
  { title: "Test Campaign" },
  { $set: { status: "active" } }
)
```
Then the campaign appears on `/discover` immediately.

### 2. Verify Discover page
- Go to `/discover`
- Campaign card shows: title, startup name, summary, progress bar, investors, days left, tags
- Search "test" → filters to matching campaigns
- Sort by "Ending Soon" → reorders

### 3. Verify Campaign Detail
- Click a campaign card
- Detail page shows: all meta fields, milestone roadmap, startup profile card
- As investor role: "🦊 Invest" button appears
- As startup/unauthenticated: appropriate gate message shown

### 4. Verify Landing featured section
- Go to `/`
- If active campaigns exist → "Featured Campaigns" section appears with real cards that link to `/campaigns/:id`

---

## Assumptions Made

| Assumption | Reason |
|------------|--------|
| `campaign.description` field optional | Backend model may not have it; we fall back to `summary` repeated |
| `startupProfileId.socialLinks` is `{ linkedin, twitter, github }` | Matches StartupProfile schema from earlier sprint |
| `currentMilestoneIndex` is 0-based | Matches backend Milestone model |
| Backend text-search index may not exist | `?search=` uses `$text` — works only if text index is created on Campaign model |

---

## What's Next

| Feature | Phase |
|---------|-------|
| MetaMask invest flow (`POST /investments`) | Next sprint |
| Investor dashboard (portfolio/history) | Next sprint |
| Public Discover without auth (open access) | Backend middleware change |
| Admin milestone approval UI | Admin phase |
