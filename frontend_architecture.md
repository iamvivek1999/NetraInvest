# Frontend Architecture Plan — Enigma Invest MVP

## 1. Tech Choice

| Decision | Choice | Justification |
|---|---|---|
| Framework | **Vite + React 18** | Pure SPA — no SSR complexity, fastest dev startup, naturally aligns with MetaMask (client-only), easiest to deploy |
| Routing | **React Router v6** | File-free declarative routing, nested layouts, easy role-protected routes |
| State | **Zustand** | Zero boilerplate, no Provider wrapping, auth state in one store |
| Server state | **TanStack React Query v5** | Handles loading/error/caching/refetch for all API calls; no manual useEffect fetch patterns |
| Styling | **Vanilla CSS + CSS variables** | Already the project standard; fine for a hackathon — no Tailwind complexity |
| Wallet | **ethers.js v6** (browser) | Same library as contracts folder; direct MetaMask access via `window.ethereum`; no wagmi or RainbowKit overhead |
| HTTP client | **Axios** with an interceptor | Auto-attach Authorization header; unified 401 handling |
| Notifications | **React Hot Toast** | One-line toasts for tx confirmations, errors, success — essential for blockchain UX |

**Why not Next.js?**
The backend is a full standalone REST API. Server-side rendering adds zero value here and  would complicate the MetaMask integration (which must run in the browser). Vite gives faster cold starts for demo.

**Why not wagmi/RainbowKit?**
wagmi v2 is powerful but adds ~200KB and a steep config curve. For a single-wallet hackathon demo targeting MetaMask only, direct `window.ethereum` + ethers.js is 30 lines of code and no extra dependencies. Can be upgraded to wagmi after the demo.

---

## 2. Page Structure

### Public (no auth required)
| Page | Route | Purpose |
|---|---|---|
| Landing | `/` | Hero, platform pitch, featured campaigns, CTA buttons |
| Discover | `/discover` | All active campaigns, filterable by status/search |
| Campaign Detail | `/campaigns/:campaignId` | Campaign info, funding progress, milestone roadmap, Invest button |
| Login | `/login` | Email + password login |
| Register | `/register` | Email + password + role selection (investor / startup) |

### Investor (auth: `investor` role)
| Page | Route | Purpose |
|---|---|---|
| Investor Dashboard | `/dashboard` | Portfolio summary, total invested, active campaigns invested in |
| My Investments | `/dashboard/investments` | Paginated investment history with tx links |

### Startup (auth: `startup` role)
| Page | Route | Purpose |
|---|---|---|
| Startup Dashboard | `/dashboard` | All campaigns — raised totals, milestone progress, investor count |
| My Campaigns | `/dashboard/campaigns` | Campaign list with quick status pills |
| Create Campaign | `/dashboard/campaigns/new` | Multi-step form: details → milestones config |
| Campaign Manager | `/dashboard/campaigns/:campaignId` | Edit, activate, view investments, milestone controls |
| Milestone Manager | `/dashboard/campaigns/:campaignId/milestones` | Create milestones, submit proof, view status |
| Profile Setup | `/dashboard/profile` | Create / edit startup profile (required before first campaign) |

### Admin (minimal — Postman-first, thin UI as bonus)
| Page | Route | Purpose |
|---|---|---|
| Milestone Review | `/admin/milestones` | List submitted milestones; Approve / Reject / Release buttons |

> **Note:** `/dashboard` renders different content based on `role` — investor gets their portfolio, startup gets their campaign hub. Same URL, role-switched layout.

---

## 3. Route Structure

```
/                            → Landing
/discover                    → Discover campaigns
/campaigns/:campaignId       → Campaign detail (public)
/login                       → Login
/register                    → Register

/dashboard                   → Role-switched: InvestorDashboard OR StartupDashboard
/dashboard/investments        → Investor only
/dashboard/campaigns          → Startup only
/dashboard/campaigns/new      → Startup only
/dashboard/campaigns/:id      → Startup only
/dashboard/campaigns/:id/milestones → Startup only
/dashboard/profile            → Startup only

/admin/milestones             → Admin only
```

### Route Guard Model
```
Public routes       → anyone
ProtectedRoute      → requires valid JWT in Zustand store → else redirect /login
RoleGuard('startup')→ requires role === 'startup' → else redirect /dashboard
RoleGuard('investor')→ requires role === 'investor'
RoleGuard('admin')  → requires role === 'admin'
```

---

## 4. Folder Structure

```
d:\Enigma\frontend\
├── public/
│   └── enigma-logo.svg
├── src/
│   │
│   ├── api/                        ← All API call functions (no UI logic)
│   │   ├── client.js               ← Axios instance + auth interceptor + 401 handler
│   │   ├── auth.api.js             ← login, register, linkWallet
│   │   ├── campaigns.api.js        ← getCampaigns, getCampaign, createCampaign,
│   │   │                              updateCampaign, activateCampaign, getMyCampaigns
│   │   ├── milestones.api.js       ← createMilestones, getMilestones, submitProof,
│   │   │                              approveMilestone, rejectMilestone, releaseMilestone
│   │   ├── investments.api.js      ← recordInvestment, getMyInvestments,
│   │   │                              getCampaignInvestments, getStartupInvestments
│   │   └── startups.api.js         ← createProfile, updateProfile, getProfile, getAllProfiles
│   │
│   ├── components/
│   │   ├── ui/                     ← Generic, role-agnostic building blocks
│   │   │   ├── Button.jsx
│   │   │   ├── Card.jsx
│   │   │   ├── Badge.jsx           ← status pill: active/draft/pending etc.
│   │   │   ├── Modal.jsx
│   │   │   ├── Spinner.jsx
│   │   │   ├── ProgressBar.jsx
│   │   │   ├── FormField.jsx       ← label + input + error message
│   │   │   ├── Stat.jsx            ← number + label dashboard card
│   │   │   ├── Alert.jsx
│   │   │   └── Pagination.jsx
│   │   │
│   │   └── domain/                 ← App-specific, know about data shapes
│   │       ├── CampaignCard.jsx    ← used in /discover and dashboards
│   │       ├── FundingProgress.jsx ← goal bar with raised/goal amounts
│   │       ├── MilestoneTimeline.jsx
│   │       ├── MilestoneItem.jsx
│   │       ├── InvestmentRow.jsx
│   │       ├── WalletButton.jsx    ← connect / show address / disconnect
│   │       ├── InvestModal.jsx     ← core investor flow: amount → MetaMask → wait → record
│   │       ├── TransactionBadge.jsx← tx hash + PolygonScan link
│   │       └── StartupProfileCard.jsx
│   │
│   ├── layouts/
│   │   ├── AppShell.jsx            ← Navbar + children + Footer
│   │   ├── Navbar.jsx
│   │   ├── Footer.jsx
│   │   └── DashboardSidebar.jsx    ← role-aware sidebar navigation
│   │
│   ├── pages/
│   │   ├── Landing.jsx
│   │   ├── Discover.jsx
│   │   ├── CampaignDetail.jsx
│   │   ├── Login.jsx
│   │   ├── Register.jsx
│   │   ├── NotFound.jsx
│   │   ├── dashboard/
│   │   │   ├── DashboardRouter.jsx      ← switches between investor vs startup view
│   │   │   ├── InvestorDashboard.jsx
│   │   │   ├── InvestorInvestments.jsx
│   │   │   ├── StartupDashboard.jsx
│   │   │   ├── MyCampaigns.jsx
│   │   │   ├── CreateCampaign.jsx
│   │   │   ├── CampaignManager.jsx
│   │   │   ├── MilestoneManager.jsx
│   │   │   └── StartupProfile.jsx
│   │   └── admin/
│   │       └── MilestoneReview.jsx
│   │
│   ├── router/
│   │   ├── index.jsx               ← createBrowserRouter() definition
│   │   ├── ProtectedRoute.jsx      ← checks authStore.token → redirect /login
│   │   └── RoleGuard.jsx           ← checks authStore.role → redirect /dashboard
│   │
│   ├── hooks/
│   │   ├── useWallet.js            ← MetaMask: connect, network check, invest()
│   │   ├── useCampaigns.js         ← React Query wrappers for campaigns API
│   │   ├── useMilestones.js        ← React Query wrappers for milestone API
│   │   └── useInvestments.js       ← React Query wrappers for investment API
│   │
│   ├── store/
│   │   └── authStore.js            ← Zustand: { user, token, role, walletAddress, setAuth, logout }
│   │
│   ├── utils/
│   │   ├── contract.js             ← getContract(signer): ethers Contract instance
│   │   ├── formatters.js           ← formatMATIC, formatDate, shortenAddress
│   │   └── constants.js            ← VITE_CONTRACT_ADDRESS, VITE_CHAIN_ID, VITE_API_URL
│   │
│   ├── index.css                   ← global CSS variables + resets
│   ├── App.jsx
│   └── main.jsx
│
├── .env.local                      ← VITE_ prefixed env vars
├── vite.config.js
└── package.json
```

---

## 5. Auth State Handling

### Zustand `authStore`
```
{
  user:          { _id, fullName, email, role, walletAddress } | null
  token:         string | null
  role:          'investor' | 'startup' | 'admin' | null
  isLoggedIn:    boolean (derived)

  setAuth(user, token)   → called after successful login/register
  logout()               → clears store + localStorage + redirects /login
  hydrateFromStorage()   → called on app mount — restores session from localStorage
}
```

### Token persistence strategy
- `token` stored in **localStorage** under `enigma_token`
- `user` stored in **localStorage** under `enigma_user`
- On app mount (`App.jsx`): `authStore.hydrateFromStorage()` restores session
- On 401 from Axios interceptor: `authStore.logout()` → navigate to `/login`

### Axios interceptor
```
requests:  attach   Authorization: Bearer <token>
responses: on 401 → logout() + redirect /login
           on 503 → toast "Blockchain service unavailable"
```

---

## 6. API Integration Approach

### Pattern: thin API module + React Query hook
```
api/campaigns.api.js         → pure async functions, return data
hooks/useCampaigns.js        → useQuery / useMutation wrappers
pages/Discover.jsx           → const { data, isLoading } = useCampaigns()
```

This keeps components clean — no useEffect, no manual loading state.

### React Query key conventions
```
['campaigns']                     → all active campaigns
['campaigns', campaignId]         → single campaign
['campaigns', 'my']               → startup's own campaigns
['milestones', campaignId]        → milestones for a campaign
['investments', 'my']             → investor's investments
['investments', 'campaign', id]   → campaign's investment list
['investments', 'startup']        → startup portfolio
```

### Error handling
- React Query's `onError` → `toast.error(error.response?.data?.message)`
- Mutation `onSuccess` → `toast.success(message)` + `queryClient.invalidateQueries()`

---

## 7. Wallet Integration Approach

### `useWallet` hook responsibilities
```
state:
  provider        EthersProvider | null
  signer          EthersSigner  | null
  address         string | null
  isConnected     boolean
  networkOk       boolean        (Polygon Amoy chainId check)

actions:
  connectWallet()          → window.ethereum.request({ method: 'eth_requestAccounts' })
  ensureCorrectNetwork()   → wallet_switchEthereumChain to Amoy if mismatch
  invest(campaignKey, amount) → contract.invest(campaignKey, { value: parseEther(amount) })
  linkWalletToProfile(address)  → PATCH /auth/wallet
```

### Wallet connection flow
```
1. User clicks "Connect Wallet"
2. window.ethereum.request('eth_requestAccounts') → MetaMask popup
3. Check chainId === 80002 (Amoy) or prompt switch
4. Store address in local component state (NOT in Zustand — wallet can change independently)
5. If user has role=startup and is activating campaign: also PATCH /auth/wallet to link
```

### Invest transaction flow (`InvestModal`)
```
1. Investor inputs amount (MATIC)
2. Validate: >= minInvestment, <= maxInvestment, campaign active
3. connectWallet() if not already connected
4. ensureCorrectNetwork() → switch to Amoy if needed
5. getContract(signer).invest(campaignKey, { value: parseEther(amount) })
6. Show "Waiting for wallet confirmation..." (MetaMask popup)
7. tx = await contract call → show "Transaction submitted..."
8. receipt = await tx.wait(1) → show "Confirmed on block #N"
9. POST /api/v1/investments { campaignId, txHash: receipt.hash, walletAddress, amount }
10. Show success + link to PolygonScan
11. Invalidate React Query cache → FundingProgress updates
```

### `utils/contract.js`
```js
// Returns a connected contract instance for investment calls
getContract(signer | provider) → ethers.Contract(ADDRESS, ABI, signer)
```

ABI is loaded from: `src/utils/abi/InvestmentPlatform.json`  
(synced from contracts/artifacts by `npm run sync:abi` in the backend — copy the same file here)

---

## 8. Investor Flow Pages

### `/discover` — Discover Campaigns
- Grid of `CampaignCard` components
- Filters: status, currency, search text
- Pagination (12 per page)
- Each card: startup name, title, funding progress bar, deadline countdown, Invest CTA

### `/campaigns/:campaignId` — Campaign Detail
- Hero: campaign title, startup name, status badge
- `FundingProgress`: raised / goal, % complete, investor count
- Milestone roadmap: `MilestoneTimeline` (read-only for investors)
- Startup profile mini-card with industry, tagline
- **Invest section** (right column or bottom):
  - **WalletButton**: Connect MetaMask
  - Amount input with min/max hints
  - "Invest Now" → opens `InvestModal`
  - Recent investments list (anonymous amounts)

### `/dashboard` (investor view) — Portfolio Dashboard
- Stats row: total invested, active campaigns count, confirmed tx count
- Table / cards: recent investments with campaign name, amount, status, tx hash link
- Link to `/dashboard/investments` for full history

### `/dashboard/investments` — Investment History
- Paginated table: campaign, amount, date, status badge, tx hash (with PolygonScan link)
- Filter by status

---

## 9. Startup Flow Pages

### `/dashboard/profile` — Startup Profile Setup
- Form: startup name, tagline, description, industry, website, social links, team
- Save → `POST /api/v1/startups` (first time) or `PATCH /api/v1/startups/me`
- Profile completeness score displayed
- **Must be completed before campaign creation** (enforced in backend, show inline gate)

### `/dashboard/campaigns/new` — Create Campaign (2-step flow)
- **Step 1 — Details**: title, summary, fundingGoal (MATIC), min/maxInvestment, deadline, currency, tags
- **Step 2 — Milestones**: add 1–5 milestones (title, description, percentage, targetDate)
  - Percentage total must reach 100 before step 2 can be submitted
- On submit: `POST /campaigns` → then `POST /campaigns/:id/milestones`

### `/dashboard/campaigns` — My Campaigns List
- Table of campaigns with status badge, raised/goal, milestone progress, actions
- Quick links: View | Manage | Activate

### `/dashboard/campaigns/:campaignId` — Campaign Manager
- Tabs: **Overview** | **Investments** | **Milestones**
- **Overview tab**:
  - Campaign details (editable if draft)
  - Status pill + transition controls:
    - Draft: "Activate Campaign" button → wallet check → POST /activate
    - Active: "Pause" button → PATCH status:paused
    - Paused: "Resume" button → PATCH status:active
  - `FundingProgress` component
  - Stats: investorCount, currentRaised, currentReleased
- **Investments tab**:
  - `getCampaignInvestments` table with investor wallet (shortened), amount, date, tx link
- **Milestones tab**: full `MilestoneManager`

### `/dashboard/campaigns/:campaignId/milestones` — Milestone Manager
- List of milestones ordered by index
- Each milestone shows:
  - Status badge (pending / submitted / approved / released / rejected)
  - "Submit Proof" button (startup, own milestone, status=pending or rejected, current index matches)
  - Proof form: description + proof links + document URLs
- Admin actions (approve/reject/release) only visible if role=admin

### Campaign Activation Flow (within Campaign Manager)
```
User clicks "Activate Campaign"
→ Check walletAddress linked (PATCH /auth/wallet if not)
→ Confirm: "This will register your campaign on Polygon Amoy blockchain"
→ POST /campaigns/:id/activate
→ Show spinner "Registering on-chain... waiting for confirmation"
→ On success: campaign status → active, show txHash pill
```

---

## 10. Admin Flow

> **Strategy:** Keep admin minimal for the hackathon. Postman covers the admin flows already. A thin read-only UI with action buttons is sufficient for demo purposes.

### `/admin/milestones` — Milestone Review Queue
- Single table: all submissions with status=`submitted`
- Columns: campaign name, milestone title, startup name, submitted at, proof links
- Per row: **Approve** button (green) | **Reject** button (red)
  - Approve → `PATCH /milestones/:id/approve` → row updates to status=approved
- "Approved" tab: milestones with status=approved
  - Per row: **Release** button (purple) → `PATCH /milestones/:id/release` → blockchain call
- No admin dashboard, no admin profile management, no user management

Admin JWT is obtained via Postman (login as admin@enigmainvest.dev) and pasted into a dev-only header input on this page. No admin login page needed for MVP.

---

## 11. Dashboard Page Structure

### Role-switched rendering
```
/dashboard → <DashboardRouter>
               if role === 'investor' → <InvestorDashboard>
               if role === 'startup'  → <StartupDashboard>
               if role === 'admin'    → redirect /admin/milestones
```

### Investor Dashboard layout
```
┌─────────────────────────────────────────────────────┐
│ NAVBAR                                              │
├─────────────────────────────────────────────────────┤
│  Stats row: [Total Invested]  [Campaigns]  [Txns]   │
├─────────────────────────────────────────────────────┤
│  Active Investments (campaign cards, 3 per row)     │
├─────────────────────────────────────────────────────┤
│  Recent Transactions (table, 5 rows + view all)     │
└─────────────────────────────────────────────────────┘
```

### Startup Dashboard layout
```
┌──────────┬──────────────────────────────────────────┐
│ Sidebar  │  Stats: [Total Raised]  [Investors]  [Campaigns] │
│  - Overview│                                        │
│  - Campaigns│ Active Campaign card(s) with progress  │
│  - Profile │                                        │
│          │  Milestone queue (next pending action)   │
└──────────┴──────────────────────────────────────────┘
```

---

## 12. Recommended UI Priorities for Hackathon Demo

Build in this order — stop when demo-ready:

### Priority 1 — Core demo loop (do first)
1. **Landing page** — hero section, "Discover Campaigns" CTA. First impression matters.
2. **Discover page** — campaign grid with real data from backend
3. **Campaign detail page** + `FundingProgress` + `MilestoneTimeline`
4. **InvestModal** — the WOW moment: MetaMask → tx → confirmed → POST → update UI
5. **Investor dashboard** — shows "your investment exists"
6. **Login / Register** — auth gates everything else

### Priority 2 — Startup credibility
7. **Startup profile form**
8. **Create Campaign** (2-step)
9. **Campaign Manager** — activate button (on-chain tx)
10. **Milestone submission** — submit proof UI

### Priority 3 — Admin (if time allows)
11. **Milestone review page** — approve/release with one click

### What to hardcode for demo speed
- Hardcode `CONTRACT_ADDRESS` and `CHAIN_ID=80002` in `.env.local` — no UI config
- Skip form validation beyond `required` fields for MVP
- Use `toast.loading()` / `toast.success()` instead of custom loading components
- Hard-refresh on activation/investment success is acceptable (invalidate queries)

---

## 13. What to Postpone

| Feature | Reason to Defer |
|---|---|
| Email verification UI | Backend doesn't send emails yet |
| Event listener sync | Already deferred in backend by design |
| Refund flow | Deferred in smart contract; no backend endpoint |
| Multi-wallet support (wagmi/RainbowKit) | MetaMask only is sufficient for demo |
| Dark mode | Nice to have, zero demo value |
| Mobile responsive layout | Desktop demo only |
| Admin user management | Not needed — Postman handles seed admin |
| Campaign image/media upload | No media storage configured |
| Investor notification emails | No email service configured |
| Investment portfolio analytics/charts | Recharts etc. — add post-hackathon |
| Campaign comments / Q&A section | Too complex for MVP |
| Profile image upload | No file storage backend |
| Wallet balance display | Fetchable but not critical |
| Transaction history filtering/sorting | Basic list is enough |

---

## 14. Environment Variables (`.env.local`)

```bash
VITE_API_URL=http://localhost:5000/api/v1
VITE_CONTRACT_ADDRESS=0x_fill_after_deployment
VITE_CHAIN_ID=80002        # Polygon Amoy
VITE_POLYGONSCAN_URL=https://amoy.polygonscan.com/tx
VITE_APP_NAME=Enigma Invest
```

---

## 15. State Dependency Summary

```
Zustand authStore
  └── used by: ProtectedRoute, RoleGuard, Axios interceptor,
               Navbar, DashboardRouter, all API calls

React Query cache
  └── campaigns     → Discover, CampaignDetail, StartupDashboard, MyCampaigns
  └── milestones    → CampaignManager, MilestoneManager, CampaignDetail
  └── investments   → InvestorDashboard, CampaignManager, StartupInvestments

useWallet (local hook state)
  └── used by: WalletButton, InvestModal, CampaignManager (activation)
  └── NOT in Zustand — wallet state is ephemeral per browser session
```

---

## 16. Critical Implementation Notes

1. **ABI sync**: Copy `contracts/artifacts/.../InvestmentPlatform.json` → `frontend/src/utils/abi/InvestmentPlatform.json` before writing contract calls. Keep this in sync with every contract recompile.

2. **Amount precision**: Always use `ethers.parseEther(amount.toString())` when calling `invest()`. Never pass raw numbers to the contract. Display amounts with `ethers.formatEther()`.

3. **tx.wait() UX**: The invest flow blocks for 1–2 seconds on Amoy. Show a spinner with the message "Waiting for block confirmation..." — users unfamiliar with blockchain will think it's broken without visual feedback.

4. **campaignKey passing**: The `CampaignDetail` page must fetch the campaign and pass `campaign.campaignKey` (bytes32) to the contract call — not `campaign._id`. The backend serves `campaignKey` in the campaign response JSON.

5. **investorCount race**: It's theoretically possible for two concurrent investments to both pass the `isFirstInvestment` check. For a hackathon, this is acceptable. Note it for post-MVP.

6. **Stub mode UI**: If `VITE_CONTRACT_ADDRESS` is empty/placeholder, the `InvestModal` should show a "Demo Mode" banner and skip the MetaMask step — POST directly with a fake txHash or null. Useful for investors testing the UI before contract deployment.
