/**
 * src/controllers/investment.controller.js
 *
 * Investment recording and retrieval.
 *
 * ─── recordInvestment ────────────────────────────────────────────────────────
 *   POST /api/v1/investments
 *   Role: investor only
 *
 *   Called AFTER the investor's frontend has submitted the invest() transaction
 *   and received a txHash from tx.wait(). The backend then:
 *
 *     On-chain mode (blockchain configured):
 *       1. Validates campaign is active and on-chain
 *       2. Idempotency check: reject if txHash already recorded
 *       3. Calls verifyInvestmentTx() → provider receipt + event decode
 *       4. Amount is taken from the chain event (not trusted from client)
 *       5. Investment document created with status: 'confirmed'
 *       6. Campaign.currentRaised incremented by verified amount
 *       7. Campaign.investorCount incremented if first investment from this investor
 *
 *     Stub mode (no blockchain env vars):
 *       Steps 3–4 skipped. Amount taken from request body.
 *       Investment created with status: 'unverified', chain: 'stub'.
 *       All MongoDB state updates still apply.
 *       This lets the full investment flow be demonstrated without a deployed contract.
 *
 * ─── getMyInvestments ────────────────────────────────────────────────────────
 *   GET /api/v1/investments/my
 *   Role: investor only
 *   Returns all investments for the authenticated investor with campaign details.
 *
 * ─── getCampaignInvestments ──────────────────────────────────────────────────
 *   GET /api/v1/investments/campaign/:campaignId
 *   Role: startup (own campaigns), admin
 *   Returns paginated investments for a specific campaign.
 *
 * ─── getStartupInvestments ───────────────────────────────────────────────────
 *   GET /api/v1/investments/startup
 *   Role: startup only
 *   Returns all investments across all of the startup's campaigns (dashboard view).
 */

const Campaign   = require('../models/Campaign');
const Investment = require('../models/Investment');
const sendResponse = require('../utils/sendResponse');
const { ApiError } = require('../middleware/errorHandler');
const { isBlockchainConfigured } = require('../config/blockchain');
const { verifyInvestmentTx, deriveChain } = require('../services/txVerification.service');
const notify     = require('../utils/notify');

// ─── recordInvestment ─────────────────────────────────────────────────────────

const recordInvestment = async (req, res) => {
  const { userId } = req.user;

  const {
    campaignId,
    txHash,
    walletAddress,
    amount: claimedAmount,
    currency = 'INR',
    // UPDATED FOR NON-BLOCKCHAIN PAYMENT FLOW
    paymentId,
    paymentProvider,
  } = req.body;

  // ── 1. Validate request fields ───────────────────────────────────────────────

  if (!campaignId) throw new ApiError('campaignId is required.', 400);
  // UPDATED FOR NON-BLOCKCHAIN PAYMENT FLOW: walletAddress is optional now

  const blockchainEnabled = isBlockchainConfigured();

  if (blockchainEnabled && !txHash) {
    throw new ApiError(
      'txHash is required when blockchain is configured. ' +
        'Submit the invest() transaction first, then provide the txHash.',
      400
    );
  }

  if (!blockchainEnabled && (!claimedAmount || claimedAmount <= 0)) {
    throw new ApiError('amount must be a positive number in stub mode.', 400);
  }

  // ── Address normalization ─────────────────────────────────────────────────
  // Normalize both addresses to lowercase exactly once here, before any
  // comparison, idempotency check, or storage operation. This prevents the
  // same transaction hash (e.g. 0xABCD... vs 0xabcd...) from bypassing the
  // unique index and being recorded twice.

  const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
  // UPDATED FOR NON-BLOCKCHAIN PAYMENT FLOW
  let normalizedWallet = walletAddress ? walletAddress.toLowerCase() : '0x0000000000000000000000000000000000000000';
  if (walletAddress && !ethAddressRegex.test(normalizedWallet)) {
    throw new ApiError('walletAddress must be a valid Ethereum address (0x + 40 hex chars).', 400);
  }

  let normalizedTxHash = null;
  if (txHash) {
    const txHashRegex = /^0x[a-fA-F0-9]{64}$/;
    if (!txHashRegex.test(txHash)) {
      throw new ApiError('txHash must be a valid Ethereum transaction hash (0x + 64 hex chars).', 400);
    }
    normalizedTxHash = txHash.toLowerCase();
  }

  // ── 2. Load campaign and validate it accepts investments ──────────────────────

  const campaign = await Campaign.findById(campaignId);
  if (!campaign) throw new ApiError('Campaign not found.', 404);

  // This check applies to BOTH on-chain mode and stub mode.
  // Stub mode does not bypass it — only active campaigns accept investments
  // regardless of whether blockchain is configured.
  if (campaign.status !== 'active') {
    throw new ApiError(
      `Campaign is not accepting investments (status: "${campaign.status}"). ` +
        'Only active campaigns accept investments.',
      400
    );
  }

  if (new Date() > new Date(campaign.deadline)) {
    throw new ApiError('Campaign deadline has passed. Investments are no longer accepted.', 400);
  }

  // ── 3. Validate investment amount limits (stub + on-chain pre-check) ──────────

  if (claimedAmount && campaign.minInvestment && claimedAmount < campaign.minInvestment) {
    throw new ApiError(
      `Minimum investment is ${campaign.minInvestment} ${currency}. You provided ${claimedAmount}.`,
      400
    );
  }

  if (claimedAmount && campaign.maxInvestment && claimedAmount > campaign.maxInvestment) {
    throw new ApiError(
      `Maximum investment is ${campaign.maxInvestment} ${currency}. You provided ${claimedAmount}.`,
      400
    );
  }

  // ── 4. Idempotency check ──────────────────────────────────────────────────────
  // normalizedTxHash is lowercase — the Investment model's sparse unique index
  // enforces DB-level uniqueness, but we check here first for a clear 409 error
  // rather than a raw Mongoose duplicate key error.
  // Guards against the same txHash being submitted with different letter casing.

  if (normalizedTxHash) {
    const existingByTx = await Investment.findOne({ txHash: normalizedTxHash });
    if (existingByTx) {
      throw new ApiError(
        `Transaction ${normalizedTxHash} has already been recorded. ` +
          'Each transaction can only be submitted once. ' +
          'currentRaised has NOT been updated again.',
        409
      );
    }
  }

  // ── 5. On-chain verification vs stub path ─────────────────────────────────────

  let finalAmount     = claimedAmount;
  let amountWei       = null;
  let blockNumber     = null;
  let confirmedAt     = null;
  let status          = 'unverified';
  let verificationNote = 'stub: no blockchain verification performed';
  const chain         = deriveChain();

  // UPDATED FOR NON-BLOCKCHAIN PAYMENT FLOW
  if (paymentProvider === 'stub') {
    // skip blockchain verification directly create investment record
    confirmedAt = new Date();
    status = 'confirmed';
    verificationNote = 'Payment simulated successfully';
  } else if (blockchainEnabled) {
    // Campaign must be on-chain before it can receive verified investments
    if (!campaign.isContractDeployed || !campaign.campaignKey) {
      throw new ApiError(
        'Campaign is not yet registered in the transparency log. ' +
          'The startup must activate the campaign (POST /campaigns/:id/activate) before investments can be recorded.',
        400
      );
    }

    // normalizedWallet is passed so the comparison inside verifyInvestmentTx
    // uses the same canonical value that will be stored in the DB.
    const result = await verifyInvestmentTx({
      txHash:               normalizedTxHash,
      expectedCampaignKey:  campaign.campaignKey,
      expectedInvestorAddr: normalizedWallet,
    });

    if (!result.success) {
      // Verification failed — throw a 422 (Unprocessable Entity) with the reason
      throw new ApiError(
        `Transaction verification failed: ${result.error}`,
        422
      );
    }

    // Use the authoritative amount from the chain (ignore client's claimed amount)
    finalAmount      = result.amountINR;
    amountWei        = result.amountWei;
    blockNumber      = result.blockNumber;
    confirmedAt      = result.confirmedAt;
    status           = 'confirmed';
    verificationNote = result.note;
  } else {
    // Stub mode: use claimed amount, mark confirmed at now
    confirmedAt = new Date();
  }

  // ── 6. Check if this is the investor's first investment in this campaign ────────
  //
  // Queried BEFORE creating the new document, so the current record doesn't
  // interfere with the count. Only prior 'confirmed' or 'unverified' investments
  // count — 'failed' status investments do not affect investorCount.
  //
  // investorCount is incremented by exactly 1 on the first investment, and by 0
  // on every subsequent investment by the same investor in the same campaign.
  // This is enforced here (application layer) and separately by the compound
  // index { campaignId, investorUserId } that enables fast lookups for this check.

  const isFirstInvestment = !(await Investment.exists({
    campaignId,
    investorUserId: userId,
    status:         { $in: ['confirmed', 'unverified'] },
  }));

  // ── 7. Record the investment ──────────────────────────────────────────────────

  const investmentData = {
    campaignId,
    startupProfileId:  campaign.startupProfileId,
    investorUserId:    userId,
    walletAddress:     normalizedWallet,        // always lowercase — normalized once at step 1
    campaignKey:       campaign.campaignKey || null,
    contractAddress:   campaign.contractAddress || null,
    amount:            finalAmount,
    amountWei,
    currency,
    chain,
    status,
    confirmedAt,
    blockNumber,
    verificationNote,
    // UPDATED FOR NON-BLOCKCHAIN PAYMENT FLOW
    paymentId,
    paymentProvider,
  };

  if (normalizedTxHash) {
    investmentData.txHash = normalizedTxHash;
  }

  const investment = await Investment.create(investmentData);

  // ── 8. Update campaign totals ─────────────────────────────────────────────────
  // Only reached if Investment.create() succeeded — atomic enough for MVP.
  // Phase 2 can wrap steps 7+8 in a MongoDB session/transaction for full ACID.

  await Campaign.findByIdAndUpdate(campaignId, {
    $inc: {
      currentRaised:  finalAmount,
      investorCount:  isFirstInvestment ? 1 : 0,
    },
  });

  const populated = await Investment.findById(investment._id)
    .populate('campaignId', 'title fundingGoal currentRaised currency')
    .populate('investorUserId', 'fullName email');

  // ── 9. Trigger notifications (fire-and-forget) ────────────────────────────────
  const amountLabel = `₹${finalAmount?.toLocaleString('en-IN') ?? finalAmount}`;
  const campaignTitle = campaign.title ?? 'a campaign';

  // Notify the investor that their investment was confirmed
  notify(
    userId,
    'investment_confirmed',
    `Your ${amountLabel} investment in "${campaignTitle}" was confirmed successfully.`,
    { campaignId: campaign._id, investmentId: investment._id }
  );

  // Notify the startup that they received an investment
  if (campaign.userId) {
    notify(
      campaign.userId,
      'investment_received',
      `${amountLabel} was invested in your campaign "${campaignTitle}".`,
      { campaignId: campaign._id, investmentId: investment._id }
    );
  }

  sendResponse(res, 201, 'Investment recorded successfully.', {
    investment: populated,
    verification: {
      mode:   blockchainEnabled ? 'on-chain' : 'stub',
      status,
      note:   verificationNote,
    },
  });
};

// ─── getMyInvestments ─────────────────────────────────────────────────────────

/**
 * GET /api/v1/investments/my
 * Role: investor only
 *
 * Query params:
 *   status → filter by status ('confirmed', 'unverified', 'failed')
 *   page   → page number (default 1)
 *   limit  → per page (default 10, max 50)
 */
const getMyInvestments = async (req, res) => {
  const { userId } = req.user;
  const { status, page = 1, limit = 10 } = req.query;

  const filter = { investorUserId: userId };
  if (status) filter.status = status;

  const pageNum  = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
  const skip     = (pageNum - 1) * limitNum;

  const [investments, total] = await Promise.all([
    Investment.find(filter)
      .populate('campaignId', 'title fundingGoal currentRaised currency status deadline')
      .populate('startupProfileId', 'startupName industry')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Investment.countDocuments(filter),
  ]);

  // Investor-level aggregate summary across ALL their investments (unverified/confirmed)
  const summaryAgg = await Investment.aggregate([
    { $match: { investorUserId: userId, status: { $in: ['confirmed', 'unverified'] } } },
    {
      $group: {
        _id: null,
        totalAmount:     { $sum: '$amount' },
        uniqueCampaigns: { $addToSet: '$campaignId' },
      },
    },
    {
      $project: {
        totalAmount:   1,
        campaignCount: { $size: '$uniqueCampaigns' },
      },
    },
  ]);

  const summary = summaryAgg[0] || {
    totalAmount: 0,
    campaignCount: 0,
  };

  sendResponse(
    res,
    200,
    'Your investments retrieved.',
    { investments, summary },
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

// ─── getCampaignInvestments ───────────────────────────────────────────────────

/**
 * GET /api/v1/investments/campaign/:campaignId
 * Role: startup (own campaigns only), admin
 *
 * Investors cannot see the investor list for privacy; only the campaign owner can.
 * Admin can see any campaign's investments.
 *
 * Query params:
 *   page  → default 1
 *   limit → default 20, max 50
 */
const getCampaignInvestments = async (req, res) => {
  const { campaignId } = req.params;
  const { userId, role } = req.user;
  const { page = 1, limit = 20 } = req.query;

  const campaign = await Campaign.findById(campaignId).select('userId startupProfileId title');
  if (!campaign) throw new ApiError('Campaign not found.', 404);

  // Ownership: startup can only see their own campaign's investments
  if (role === 'startup' && campaign.userId.toString() !== userId) {
    throw new ApiError('You are not authorized to view investments for this campaign.', 403);
  }

  const pageNum  = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
  const skip     = (pageNum - 1) * limitNum;

  const [investments, total] = await Promise.all([
    Investment.find({ campaignId })
      .populate('investorUserId', 'fullName walletAddress')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Investment.countDocuments({ campaignId }),
  ]);

  // Aggregate totals for this campaign
  const totals = await Investment.aggregate([
    { $match: { campaignId: campaign._id, status: { $in: ['confirmed', 'unverified'] } } },
    {
      $group: {
        _id:           null,
        totalAmount:   { $sum: '$amount' },
        uniqueInvestors: { $addToSet: '$investorUserId' },
      },
    },
    {
      $project: {
        totalAmount:    1,
        investorCount:  { $size: '$uniqueInvestors' },
      },
    },
  ]);

  const summary = totals[0] || { totalAmount: 0, investorCount: 0 };

  sendResponse(
    res,
    200,
    `Investments for campaign "${campaign.title}" retrieved.`,
    { investments, summary },
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

// ─── getStartupInvestments ────────────────────────────────────────────────────

/**
 * GET /api/v1/investments/startup
 * Role: startup only
 *
 * Dashboard view: all investments across all of the startup's campaigns.
 * Groups by campaign for an overview.
 *
 * Query params:
 *   page  → default 1
 *   limit → default 20, max 50
 */
const getStartupInvestments = async (req, res) => {
  const { userId } = req.user;
  const { page = 1, limit = 20 } = req.query;

  const pageNum  = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
  const skip     = (pageNum - 1) * limitNum;

  // Get all campaign IDs for this startup first
  const campaigns = await Campaign.find({ userId }).select('_id').lean();
  const campaignIds = campaigns.map((c) => c._id);

  if (campaignIds.length === 0) {
    return sendResponse(res, 200, 'No campaigns found for your account.', {
      investments: [],
      summary: { totalAmount: 0, investorCount: 0, campaignCount: 0 },
    });
  }

  const filter = { campaignId: { $in: campaignIds } };

  const [investments, total] = await Promise.all([
    Investment.find(filter)
      .populate('campaignId', 'title status currency')
      .populate('investorUserId', 'fullName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Investment.countDocuments(filter),
  ]);

  // Portfolio-level aggregate summary
  const summary = await Investment.aggregate([
    { $match: { campaignId: { $in: campaignIds }, status: { $in: ['confirmed', 'unverified'] } } },
    {
      $group: {
        _id:            null,
        totalAmount:    { $sum: '$amount' },
        uniqueInvestors: { $addToSet: '$investorUserId' },
      },
    },
    {
      $project: {
        totalAmount:      1,
        investorCount:    { $size: '$uniqueInvestors' },
        campaignCount:    { $literal: campaignIds.length },
      },
    },
  ]);

  const portfolioSummary = summary[0] || {
    totalAmount: 0,
    investorCount: 0,
    campaignCount: campaignIds.length,
  };

  sendResponse(
    res,
    200,
    'Startup portfolio investments retrieved.',
    { investments, summary: portfolioSummary },
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

module.exports = {
  recordInvestment,
  getMyInvestments,
  getCampaignInvestments,
  getStartupInvestments,
};
