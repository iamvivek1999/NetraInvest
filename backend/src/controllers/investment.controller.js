/**
 * src/controllers/investment.controller.js
 *
 * Investment recording and retrieval.
 *
 * ─── recordInvestment ────────────────────────────────────────────────────────
 *   POST /api/v1/investments
 *   Role: investor only
 *
 *   The ONLY way to record an investment. Called AFTER the investor's frontend
 *   has submitted the invest() transaction and tx.wait(1) has resolved.
 *
 *   On-chain mode (blockchain configured):
 *     1. Fail fast if blockchain config is missing and DEV_STUB_BLOCKCHAIN_MODE=false
 *     2. txHash and walletAddress are REQUIRED
 *     3. Idempotency: if txHash already recorded → return 200 with existing record
 *     4. verifyInvestmentTx() → fetch receipt + decode InvestmentReceived event
 *     5. Amount is taken from the chain event (client claimed amount ignored)
 *     6. Investment created with status: 'confirmed'
 *     7. Campaign.currentRaisedWei updated atomically via BigInt arithmetic
 *     8. Campaign.investorCount incremented if first investment from this investor
 *
 *   Stub mode (DEV_STUB_BLOCKCHAIN_MODE=true, non-production only):
 *     Steps 4–5 skipped.
 *     Amount taken from request body (claimedAmount).
 *     Investment created with status: 'stub' (distinct from 'confirmed').
 *     A console.warn is emitted every time — never invisible.
 *     NEVER active in production (env.js post-load guard zeros it out).
 *
 *   REMOVED from this controller:
 *     - paymentProvider / paymentId (Razorpay path moved to /payments-legacy)
 *     - Silent fallback when !blockchainEnabled (now fails with 503)
 *     - 409 on duplicate txHash (now returns 200 idempotently)
 *
 * ─── getMyInvestments, getCampaignInvestments, getStartupInvestments ─────────
 *   Unchanged — see below.
 */

const mongoose   = require('mongoose');
const Campaign   = require('../models/Campaign');
const Investment = require('../models/Investment');
const sendResponse = require('../utils/sendResponse');
const { ApiError } = require('../middleware/errorHandler');
const { requireBlockchainOrStub } = require('../config/blockchain');
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
    currency = 'POL',
  } = req.body;

  // ── 1. Fail fast: blockchain must be configured or stub explicitly enabled ────
  //
  // requireBlockchainOrStub() throws a 503 ApiError if:
  //   - ALCHEMY_RPC_URL, ADMIN_WALLET_PRIVATE_KEY, or CONTRACT_ADDRESS is missing
  //   - AND DEV_STUB_BLOCKCHAIN_MODE is not true
  //
  // This prevents silent investment acceptance when the verification stack is
  // unavailable. No hidden fallback. No unverified records created implicitly.

  const { configured, stubMode } = requireBlockchainOrStub();

  // ── 2. Validate required fields ───────────────────────────────────────────────

  if (!campaignId) throw new ApiError('campaignId is required.', 400);

  // In blockchain mode, both txHash and walletAddress are mandatory.
  // In stub mode (explicit dev-only), they're optional — stub records are
  // clearly tagged status:'stub' and never count as on-chain confirmations.
  if (configured) {
    if (!txHash) {
      throw new ApiError(
        'txHash is required. Submit the invest() transaction via MetaMask first, ' +
        'wait for tx.wait() to resolve, then send the txHash here.',
        400
      );
    }
    if (!walletAddress) {
      throw new ApiError(
        'walletAddress is required for on-chain investment verification.',
        400
      );
    }
  }

  if (stubMode && (!claimedAmount || claimedAmount <= 0)) {
    throw new ApiError('amount must be a positive number in stub mode.', 400);
  }

  // ── 3. Normalize addresses ────────────────────────────────────────────────────

  const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
  let normalizedWallet = walletAddress ? walletAddress.toLowerCase() : null;
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

  // ── 4. Load campaign and validate it accepts investments ──────────────────────

  const campaign = await Campaign.findById(campaignId);
  if (!campaign) throw new ApiError('Campaign not found.', 404);

  if (campaign.onChainStatus !== 'active') {
    throw new ApiError(
      `Campaign is not accepting investments (onChainStatus: "${campaign.onChainStatus}"). ` +
        'Only active campaigns accept investments.',
      400
    );
  }

  if (new Date() > new Date(campaign.deadline)) {
    throw new ApiError('Campaign deadline has passed. Investments are no longer accepted.', 400);
  }

  // ── 5. Pre-check investment amount limits ──────────────────────────────────────
  // In on-chain mode we also check AFTER verification (chain amount is authoritative).
  // This pre-check uses claimedAmount for a fast UI-friendly error before burning gas.

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

  // ── 6. Idempotency check ──────────────────────────────────────────────────────
  // Changed from 409 → 200 so that frontend "Retry Sync" is safe:
  // If the same txHash was already recorded (race condition or user retry),
  // return the existing record instead of an error. The investment already succeeded.

  if (normalizedTxHash) {
    const existingByTx = await Investment.findOne({ txHash: normalizedTxHash })
      .populate('campaignId', 'title fundingGoal fundingGoalWei currentRaised currentRaisedWei currency')
      .populate('investorUserId', 'fullName email')
      .lean();

    if (existingByTx) {
      return sendResponse(res, 200, 'Transaction already recorded (idempotent sync).', {
        investment:   existingByTx,
        verification: { mode: 'idempotent', status: 'already_confirmed', note: 'txHash was already recorded — no duplicate created' },
      });
    }
  }

  // ── 7. On-chain verification vs stub path ─────────────────────────────────────

  let finalAmount     = claimedAmount;
  let amountWei       = null;
  let blockNumber     = null;
  let confirmedAt     = null;
  let syncStatus      = 'unverified';
  let verificationNote = 'not verified';
  const chain         = deriveChain();

  if (stubMode) {
    // ── STUB PATH ─────────────────────────────────────────────────────────────
    // Only reached when DEV_STUB_BLOCKCHAIN_MODE=true AND NODE_ENV !== production.
    // Logged loudly every single call — never silent.
    console.warn(
      `\n[DEV_STUB_BLOCKCHAIN_MODE] ⚠️  Skipping on-chain verification for investment.\n` +
      `  Campaign: ${campaign.title} (${campaignId})\n` +
      `  Amount:   ${claimedAmount} ${currency}\n` +
      `  This mode MUST NOT be active in production.\n`
    );
    confirmedAt      = new Date();
    syncStatus       = 'stub';
    verificationNote = 'DEV_STUB_BLOCKCHAIN_MODE: no on-chain proof — not a real investment';

  } else {
    // ── ON-CHAIN VERIFICATION PATH (default / production) ────────────────────
    // Campaign must be activated on-chain before receiving investments.
    if (campaign.onChainStatus !== 'active' || !campaign.campaignKey) {
      throw new ApiError(
        'Campaign is not yet registered on-chain. ' +
          'The startup must activate the campaign (POST /campaigns/:id/activate) before investments can be recorded.',
        400
      );
    }

    const result = await verifyInvestmentTx({
      txHash:               normalizedTxHash,
      expectedCampaignKey:  campaign.campaignKey,
      expectedInvestorAddr: normalizedWallet,
    });

    if (!result.success) {
      throw new ApiError(`Transaction verification failed: ${result.error}`, 422);
    }

    // Amount comes from the chain event — client's claimed amount is ignored
    finalAmount      = result.amountPOL;
    amountWei        = result.amountWei;
    blockNumber      = result.blockNumber;
    confirmedAt      = result.confirmedAt;
    syncStatus       = 'confirmed';
    verificationNote = result.note;
  }

  // ── 8. First-investment check ─────────────────────────────────────────────────
  // Queried BEFORE creating the new document so the count is accurate.

  const isFirstInvestment = !(await Investment.exists({
    campaignId,
    investorUserId: userId,
    syncStatus: { $in: ['confirmed', 'unverified', 'stub'] },
  }));

  // ── 9. Record the investment ──────────────────────────────────────────────────

  const investmentData = {
    campaignId,
    startupProfileId:  campaign.startupProfileId,
    investorUserId:    userId,
    walletAddress:     normalizedWallet,
    campaignKey:       campaign.campaignKey || null,
    contractAddress:   campaign.contractAddress || null,
    amount:            finalAmount,
    amountWei,
    currency,
    chain,
    syncStatus,
    confirmedAt,
    blockNumber,
    verificationNote,
  };

  if (normalizedTxHash) {
    investmentData.txHash = normalizedTxHash;
  }

  const investment = await Investment.create(investmentData);

  // ── 10. Update campaign totals ────────────────────────────────────────────────
  // BigInt-safe currentRaisedWei update (only if we have an authoritative wei value)

  const prevRaisedWei = campaign.currentRaisedWei || '0';
  const newRaisedWei  = amountWei
    ? (BigInt(prevRaisedWei) + BigInt(amountWei)).toString()
    : prevRaisedWei;

  await Campaign.findByIdAndUpdate(campaignId, {
    $inc: {
      currentRaised: finalAmount || 0,
      investorCount: isFirstInvestment ? 1 : 0,
    },
    ...(amountWei ? { $set: { totalRaisedWei: newRaisedWei } } : {}),
  });

  // ── 11. Populate for response (includes updated campaign wei fields) ───────────

  const populated = await Investment.findById(investment._id)
    .populate('campaignId', 'title fundingGoal fundingGoalWei currentRaised totalRaisedWei currency')
    .populate('investorUserId', 'fullName email');

  // ── 12. Fire-and-forget notifications ────────────────────────────────────────

  const amountLabel = amountWei
    ? `${finalAmount?.toFixed(4) ?? finalAmount} POL`
    : `${finalAmount?.toLocaleString('en-IN') ?? finalAmount} (stub)`;
  const campaignTitle = campaign.title ?? 'a campaign';

  notify(
    userId,
    'investment_confirmed',
    `Your ${amountLabel} investment in "${campaignTitle}" was confirmed successfully.`,
    { campaignId: campaign._id, investmentId: investment._id }
  );

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
      mode:   stubMode ? 'stub' : 'on-chain',
      syncStatus,
      note:   verificationNote,
    },
  });
};

// ─── getMyInvestments ─────────────────────────────────────────────────────────

/**
 * GET /api/v1/investments/my
 * Role: investor only
 */
const getMyInvestments = async (req, res) => {
  const { userId } = req.user;
  const { status, page = 1, limit = 10 } = req.query;

  const filter = { investorUserId: userId };
  if (req.query.syncStatus) filter.syncStatus = req.query.syncStatus;
  else if (req.query.status) filter.syncStatus = req.query.status;

  const pageNum  = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
  const skip     = (pageNum - 1) * limitNum;

  const [investments, total] = await Promise.all([
    Investment.find(filter)
      .populate('campaignId', 'title fundingGoal fundingGoalWei currentRaised currentRaisedWei currency status deadline')
      .populate('startupProfileId', 'startupName industry')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Investment.countDocuments(filter),
  ]);

  // Investor-level aggregate (confirmed + stub for dev, exclude failed)
  // NOTE: Mongoose does NOT auto-cast string IDs in aggregate() — must cast manually.
  const summaryAgg = await Investment.aggregate([
    { $match: { investorUserId: new mongoose.Types.ObjectId(userId), syncStatus: { $in: ['confirmed', 'unverified', 'stub'] } } },
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

  const summary = summaryAgg[0] || { totalAmount: 0, campaignCount: 0 };

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
 */
const getCampaignInvestments = async (req, res) => {
  const { campaignId } = req.params;
  const { userId, role } = req.user;
  const { page = 1, limit = 20 } = req.query;

  const campaign = await Campaign.findById(campaignId).select('userId startupProfileId title');
  if (!campaign) throw new ApiError('Campaign not found.', 404);

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

  const totals = await Investment.aggregate([
    { $match: { campaignId: campaign._id, syncStatus: { $in: ['confirmed', 'unverified', 'stub'] } } },
    {
      $group: {
        _id:             null,
        totalAmount:     { $sum: '$amount' },
        uniqueInvestors: { $addToSet: '$investorUserId' },
      },
    },
    {
      $project: {
        totalAmount:   1,
        investorCount: { $size: '$uniqueInvestors' },
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
 */
const getStartupInvestments = async (req, res) => {
  const { userId } = req.user;
  const { page = 1, limit = 20 } = req.query;

  const pageNum  = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
  const skip     = (pageNum - 1) * limitNum;

  const campaigns    = await Campaign.find({ userId }).select('_id').lean();
  const campaignIds  = campaigns.map((c) => c._id);

  if (campaignIds.length === 0) {
    return sendResponse(res, 200, 'No campaigns found for your account.', {
      investments: [],
      summary: { totalAmount: 0, investorCount: 0, campaignCount: 0 },
    });
  }

  const filter = { campaignId: { $in: campaignIds } };

  const [investments, total] = await Promise.all([
    Investment.find(filter)
      .populate('campaignId', 'title status currency fundingGoalWei currentRaisedWei')
      .populate('investorUserId', 'fullName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Investment.countDocuments(filter),
  ]);

  const summary = await Investment.aggregate([
    { $match: { campaignId: { $in: campaignIds }, syncStatus: { $in: ['confirmed', 'unverified', 'stub'] } } },
    {
      $group: {
        _id:             null,
        totalAmount:     { $sum: '$amount' },
        uniqueInvestors: { $addToSet: '$investorUserId' },
      },
    },
    {
      $project: {
        totalAmount:   1,
        investorCount: { $size: '$uniqueInvestors' },
        campaignCount: { $literal: campaignIds.length },
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
