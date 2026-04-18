/**
 * src/controllers/campaign.controller.js
 *
 * Campaign CRUD controller.
 *
 * Access control:
 *   createCampaign   → startup only, must have a startup profile
 *   activateCampaign → startup only, own campaign, triggers on-chain createCampaign
 *   updateCampaign   → startup only, own campaign only, status-aware field locks
 *   getCampaign      → any authenticated user
 *   getAllCampaigns  → any authenticated user, with filters + pagination
 *   getMyCampaigns   → startup only, their own campaigns
 *
 * Activation flow (Phase 2):
 *   POST /campaigns/:campaignId/activate
 *     1. Validates campaign is ready (milestones created, walletAddress set, etc.)
 *     2. Generates campaignKey (random bytes32)
 *     3. Calls blockchainService.activateCampaignOnChain(...)
 *     4. Saves campaignKey, contractAddress, isContractDeployed: true to MongoDB
 *     5. Sets status → 'active'
 */

const { ethers }         = require('ethers');
const Campaign          = require('../models/Campaign');
const StartupProfile    = require('../models/StartupProfile');
const Milestone         = require('../models/Milestone');
const User              = require('../models/User');
const sendResponse      = require('../utils/sendResponse');
const { ApiError }      = require('../middleware/errorHandler');
const blockchainService = require('../services/blockchain.service');

// ─── Fields locked once campaign is active ────────────────────────────────────
// These mirror what the transparency registry encodes at activation time.
// Once active (contract deployed), they must not change.
const LOCKED_WHEN_ACTIVE = [
  'fundingGoal',
  'currency',
  'milestoneCount',
  'milestonePercentages',
  'deadline',
];

// ─── Fields startup cannot set via client (system-managed) ───────────────────
const PROTECTED_FIELDS = [
  'currentRaised',
  'currentReleased',
  'investorCount',
  'currentMilestoneIndex',
  'campaignKey',
  'contractAddress',
  'isContractDeployed',
  'startupProfileId',
  'userId',
];

// ─── Helper: pick safe update fields ─────────────────────────────────────────
const pickUpdates = (body, lockedFields = []) => {
  const allBlocked = [...PROTECTED_FIELDS, ...lockedFields];
  return Object.keys(body).reduce((acc, key) => {
    if (!allBlocked.includes(key)) acc[key] = body[key];
    return acc;
  }, {});
};

// ─── Create Campaign ──────────────────────────────────────────────────────────

/**
 * POST /api/v1/campaigns
 * Role: startup only
 *
 * Checks:
 *  1. Startup must have a StartupProfile (cannot create campaign without profile)
 *  2. One active campaign per startup at a time
 */
const createCampaign = async (req, res) => {
  const { userId } = req.user;

  // Check startup profile exists
  const startupProfile = await StartupProfile.findOne({ userId });
  if (!startupProfile) {
    throw new ApiError(
      'You must create a startup profile before launching a campaign.',
      400
    );
  }

  // Enforce one active campaign per startup
  const existingActive = await Campaign.findOne({
    userId,
    status: { $in: ['active', 'paused', 'funded'] },
  });
  if (existingActive) {
    throw new ApiError(
      `You already have an active campaign ("${existingActive.title}"). ` +
        'Complete or cancel it before creating a new one.',
      409
    );
  }

  const {
    title,
    summary,
    fundingGoal,
    currency,
    minInvestment,
    maxInvestment,
    deadline,
    milestoneCount,
    milestonePercentages,
    tags,
  } = req.body;

  const campaign = await Campaign.create({
    startupProfileId: startupProfile._id,
    userId,
    title,
    summary,
    fundingGoal,
    currency,
    minInvestment,
    maxInvestment: maxInvestment || null,
    deadline: new Date(deadline),
    milestoneCount,
    milestonePercentages,
    tags: tags || [],
    status: 'draft', // always starts as draft
  });

  const populated = await Campaign.findById(campaign._id)
    .populate('startupProfileId', 'startupName industry isVerified profileCompleteness')
    .populate('userId', 'fullName email');

  sendResponse(res, 201, 'Campaign created successfully', { campaign: populated });
};

// ─── Update Campaign ──────────────────────────────────────────────────────────

/**
 * PATCH /api/v1/campaigns/:id
 * Role: startup only, own campaign only
 *
 * Status-aware field locking:
 *  - 'completed' or 'cancelled' → no updates allowed at all
 *  - 'active', 'paused', 'funded' → core financial/milestone fields locked
 *  - 'draft' → all fields editable
 *
 * Status transitions allowed from client:
 *   draft → active
 *   active → paused
 *   paused → active
 *   active/paused/draft → cancelled
 */
const updateCampaign = async (req, res) => {
  const { campaignId } = req.params;
  const { userId } = req.user;

  const campaign = await Campaign.findById(campaignId);
  if (!campaign) {
    throw new ApiError('Campaign not found.', 404);
  }

  // Ownership check
  if (campaign.userId.toString() !== userId) {
    throw new ApiError('You are not authorized to update this campaign.', 403);
  }

  // Terminal states — no updates allowed
  if (['completed', 'cancelled'].includes(campaign.status)) {
    throw new ApiError(
      `Campaign is ${campaign.status} and cannot be modified.`,
      400
    );
  }

  // Validate status transition if status is being changed
  const newStatus = req.body.status;
  if (newStatus && newStatus !== campaign.status) {
    // 'draft → active' is handled exclusively by POST /campaigns/:id/activate.
    // That route generates the campaignKey and registers the campaign on-chain.
    // Allowing it here would bypass blockchain registration.
    if (newStatus === 'active') {
      throw new ApiError(
        'To activate a campaign, use POST /api/v1/campaigns/:id/activate. ' +
          'That endpoint generates the campaignKey and registers the campaign in the transparency log.',
        400
      );
    }

    const validTransitions = {
      draft:   ['cancelled'],
      active:  ['paused', 'cancelled'],
      paused:  ['active', 'cancelled'],
      funded:  ['cancelled'],
    };

    const allowed = validTransitions[campaign.status] || [];
    if (!allowed.includes(newStatus)) {
      throw new ApiError(
        `Cannot transition campaign from "${campaign.status}" to "${newStatus}". ` +
          `Allowed transitions: ${allowed.join(', ') || 'none'}.`,
        400
      );
    }
  }

  // Lock financial/milestone fields once campaign leaves draft
  const lockedFields =
    campaign.status !== 'draft' ? LOCKED_WHEN_ACTIVE : [];

  const updates = pickUpdates(req.body, lockedFields);

  if (Object.keys(updates).length === 0) {
    throw new ApiError(
      campaign.status !== 'draft'
        ? 'No updatable fields provided. Financial configuration fields are locked once a campaign is active.'
        : 'No valid fields provided for update.',
      400
    );
  }

  const updated = await Campaign.findByIdAndUpdate(
    campaignId,
    { $set: updates },
    { new: true, runValidators: true }
  )
    .populate('startupProfileId', 'startupName industry isVerified')
    .populate('userId', 'fullName email');

  sendResponse(res, 200, 'Campaign updated successfully', { campaign: updated });
};

// ─── Get Single Campaign ──────────────────────────────────────────────────────

/**
 * GET /api/v1/campaigns/:id
 * Auth: optional (optionalAuth middleware)
 *
 * Public safe — strips campaignKey and activationTxHash for anonymous viewers.
 * These are internal blockchain secrets; only authenticated startups
 * (own campaign, via /my or dashboard) see them via the populate already present.
 */
const getCampaign = async (req, res) => {
  const campaign = await Campaign.findById(req.params.campaignId)
    .populate('startupProfileId', 'startupName tagline industry isVerified profileCompleteness socialLinks website')
    .populate('userId', 'fullName');

  if (!campaign) {
    throw new ApiError('Campaign not found.', 404);
  }

  // For non-authenticated / non-owner requests, omit sensitive blockchain fields
  const isOwner    = req.user && campaign.userId._id.toString() === req.user.userId;
  const isPrivileged = req.user && ['admin'].includes(req.user.role);

  let payload = campaign.toObject();
  if (!isOwner && !isPrivileged) {
    delete payload.campaignKey;
    delete payload.activationTxHash;
  }

  sendResponse(res, 200, 'Campaign retrieved', { campaign: payload });
};

// ─── Get All Campaigns ────────────────────────────────────────────────────────

/**
 * GET /api/v1/campaigns
 * Role: any authenticated user
 *
 * Query params:
 *   status      → filter by status (default: 'active')
 *   currency    → 'INR' | 'ETH'
 *   search      → text search on title + summary
 *   page        → page number  (default: 1)
 *   limit       → per page     (default: 12, max: 50)
 *   sortBy      → 'newest' | 'deadline' | 'goal' | 'raised'
 */
const getAllCampaigns = async (req, res) => {
  const {
    status = 'active',
    currency,
    search,
    page = 1,
    limit = 12,
    sortBy = 'newest',
  } = req.query;

  const filter = {};

  // status can be a comma-separated list: ?status=active,paused
  if (status) {
    const statuses = status.split(',').map((s) => s.trim());
    filter.status = statuses.length === 1 ? statuses[0] : { $in: statuses };
  }

  if (currency) filter.currency = currency;

  if (req.query.tags) {
    const tagsArr = req.query.tags.split(',').map((t) => t.trim());
    filter.tags = { $in: tagsArr };
  }

  if (search) {
    filter.$text = { $search: search };
  }

  // Pagination
  const pageNum  = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 12));
  const skip     = (pageNum - 1) * limitNum;

  // Sorting
  const sortMap = {
    newest:   { createdAt: -1 },
    deadline: { deadline: 1 },
    goal:     { fundingGoal: -1 },
    raised:   { currentRaised: -1 },
  };
  const sort = sortMap[sortBy] || sortMap.newest;

  const [campaigns, total] = await Promise.all([
    Campaign.find(filter)
      .populate('startupProfileId', 'startupName industry isVerified tagline')
      .populate('userId', 'fullName')
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Campaign.countDocuments(filter),
  ]);

  sendResponse(
    res,
    200,
    'Campaigns retrieved',
    { campaigns },
    {
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum),
      },
    }
  );
};

// ─── Get My Campaigns ─────────────────────────────────────────────────────────

/**
 * GET /api/v1/campaigns/my
 * Role: startup only
 *
 * Returns all campaigns belonging to the authenticated startup (any status).
 * Used by the startup dashboard.
 */
const getMyCampaigns = async (req, res) => {
  const { userId } = req.user;

  const campaigns = await Campaign.find({ userId })
    .populate('startupProfileId', 'startupName industry isVerified')
    .sort({ createdAt: -1 })
    .lean();

  sendResponse(res, 200, 'Your campaigns retrieved', { campaigns });
};

// ─── Activate Campaign (On-Chain Registration) ───────────────────────────────

/**
 * POST /api/v1/campaigns/:campaignId/activate
 * Role: startup only (own campaign)
 *
 * Pre-conditions checked before calling the contract:
 *   1. Campaign exists and belongs to the authenticated startup
 *   2. Campaign is in 'draft' status
 *   3. Campaign is not already deployed on-chain
 *   4. All required milestones exist in MongoDB
 *   5. Milestone percentages sum to 100 (double-check)
 *   6. Startup user has a valid walletAddress linked
 *   7. Deadline is in the future
 *
 * On success:
 *   - Generates a random bytes32 campaignKey
 *   - Calls contract.createCampaign(...) via blockchainService
 *   - Writes campaignKey, contractAddress, isContractDeployed: true, status: 'active'
 *
 * If blockchain is not configured:
 *   - Returns 503 with a clear error message
 */
const activateCampaign = async (req, res) => {
  const { campaignId } = req.params;
  const { userId }     = req.user;

  // ── 1. Load and authorize ─────────────────────────────────────────────────
  const campaign = await Campaign.findById(campaignId);
  if (!campaign) throw new ApiError('Campaign not found.', 404);

  if (campaign.userId.toString() !== userId) {
    throw new ApiError('You are not authorized to activate this campaign.', 403);
  }

  if (campaign.status !== 'draft') {
    throw new ApiError(
      `Campaign cannot be activated from status "${campaign.status}". ` +
        'Only draft campaigns can be activated.',
      400
    );
  }

  if (campaign.isContractDeployed) {
    throw new ApiError(
      'Campaign is already registered. It cannot be activated again.',
      409
    );
  }

  // ── 2. Validate deadline hasn't passed ────────────────────────────────────
  if (new Date(campaign.deadline) <= new Date()) {
    throw new ApiError(
      'Campaign deadline has already passed. Update the deadline before activating.',
      400
    );
  }

  // ── 3. Validate startup profile ──────────────────────────────────
  // Wallet is no longer required for activation as payments are off-chain.
  const user = await User.findById(userId).select('walletAddress');

  // ── 4. Validate all milestones are created ────────────────────────────────
  const milestoneCount = await Milestone.countDocuments({ campaignId });
  if (milestoneCount === 0) {
    throw new ApiError(
      'Campaign has no milestones. Create milestones before activating.',
      400
    );
  }
  if (milestoneCount !== campaign.milestoneCount) {
    throw new ApiError(
      `Campaign expects ${campaign.milestoneCount} milestone(s) but only ` +
        `${milestoneCount} exist. Create all milestones before activating.`,
      400
    );
  }

  // ── 5. Double-check milestone percentages sum to 100 ─────────────────────
  const pctSum = campaign.milestonePercentages.reduce((a, b) => a + b, 0);
  if (pctSum !== 100) {
    throw new ApiError(
      `Milestone percentages sum to ${pctSum}, not 100. Correct the campaign before activating.`,
      400
    );
  }


  // \u2500\u2500 6. Generate campaignKey (random bytes32) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  // ── 6. Generate campaignKey (random bytes32) ────────────────────────────────
  // ethers v5: ethers.utils.hexlify(ethers.utils.randomBytes(32))
  const campaignKey = ethers.utils.hexlify(ethers.utils.randomBytes(32));

  // ── 7. Register on-chain (or dev-mode bypass) ───────────────────────────────
  //
  // STUB_MODE=true bypasses the actual contract call so the full
  // app can function in an isolated local environment without Polygon access.
  // Useful for local testing of the "manage milestones" flow without spending INR.
  //
  // NEVER set STUB_MODE=true in production.

  let activeCampaignKey = campaignKey;
  let txHash, contractAddress;

  if (env.STUB_MODE === 'true') {
    // ── STUB MODE: Mock the on-chain data ──
    console.log(
      '[activateCampaign] STUB_MODE=true — skipping real contract call. ' +
      'Campaign will be set active without transparency registration.'
    );
    txHash          = `0xDEV_SIMULATED_${campaignKey.slice(2, 18)}`;
    contractAddress = '0xDEV0000000000000000000000000000000000000';
  } else {
    // Production path: call the real transparency contract
    // blockchainService will throw ApiError(503) if env vars are missing
    ({ txHash, contractAddress } = await blockchainService.activateCampaignOnChain({
      campaignKey,
      startupWallet:        user.walletAddress || "0x0000000000000000000000000000000000000000",
      fundingGoalINR:     campaign.fundingGoal,
      deadline:             campaign.deadline,
      milestoneCount:       campaign.milestoneCount,
      milestonePercentages: campaign.milestonePercentages,
    }));
  }

  // ── 8. Persist blockchain data + activate ────────────────────────────────
  const updatedCampaign = await Campaign.findByIdAndUpdate(
    campaignId,
    {
      $set: {
        status:             'active',
        campaignKey,
        contractAddress,
        // Keep false so the UI knows this is a stub campaign
        isContractDeployed: env.STUB_MODE !== 'true', // false in dev-mode
        activationTxHash:   txHash,
      },
    },
    { new: true, runValidators: true }
  )
    .populate('startupProfileId', 'startupName industry isVerified')
    .populate('userId', 'fullName email');

  const devNote = env.STUB_MODE === 'true'
    ? ' (Stub mode enabled. No transaction broadcasted.)'
    : '';

  return sendResponse(res, 200, `Campaign activated successfully${devNote}`, {
    campaign: updatedCampaign,
    activation: {
      campaignKey: activeCampaignKey,
      devMode: env.STUB_MODE === 'true',
    },
  });
};


module.exports = {
  createCampaign,
  activateCampaign,
  updateCampaign,
  getCampaign,
  getAllCampaigns,
  getMyCampaigns,
};
