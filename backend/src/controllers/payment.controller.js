/**
 * src/controllers/payment.controller.js
 *
 * Handles Razorpay execution
 */

const crypto = require('crypto');
const env = require('../config/env');
const Campaign = require('../models/Campaign');
const Investment = require('../models/Investment');
const razorpayService = require('../services/razorpay.service');
const blockchainLoggingService = require('../services/blockchainLogging.service'); // UPDATED FOR BLOCKCHAIN TRANSPARENCY LAYER
const sendResponse = require('../utils/sendResponse');
const { ApiError } = require('../middleware/errorHandler');

/**
 * Creates a Razorpay Order and returns order details to the frontend
 * @route POST /api/v1/payments/create-order
 */
const createOrder = async (req, res) => {
  const { campaignId, amount } = req.body;

  // 1. Validate campaign
  const campaign = await Campaign.findById(campaignId);
  if (!campaign) {
    throw new ApiError('Campaign not found.', 404);
  }

  if (campaign.status !== 'active') {
    throw new ApiError(
      `Campaign is not accepting investments (status: "${campaign.status}"). Only active campaigns accept investments.`,
      400
    );
  }

  if (new Date() > new Date(campaign.deadline)) {
    throw new ApiError('Campaign deadline has passed. Investments are no longer accepted.', 400);
  }

  if (amount && campaign.minInvestment && amount < campaign.minInvestment) {
    throw new ApiError(
      `Minimum investment is ${campaign.minInvestment}. You provided ${amount}.`,
      400
    );
  }

  if (amount && campaign.maxInvestment && amount > campaign.maxInvestment) {
    throw new ApiError(
      `Maximum investment is ${campaign.maxInvestment}. You provided ${amount}.`,
      400
    );
  }

  // 2. Generate Razorpay Order
  // Razorpay requires amount in subunits (paise for INR). 1 INR = 100 paise.
  const amountPaise = Math.round(amount * 100);
  const currency = 'INR';

  // UPDATED FOR DEPLOYMENT PREP
  // If DEV_BYPASS_PAYMENT is enabled and Razorpay is not configured, return a
  // deterministic fake order so QA can exercise the full invest flow locally.
  // CRITICAL: Redundant check for env.isDev to prevent activation in prod.
  if (env.isDev && env.DEV_BYPASS_PAYMENT && !env.RAZORPAY_KEY_ID) {
    const fakeOrderId = `dev_order_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    console.warn(`[DEV MODE] Returning fake Razorpay order: ${fakeOrderId}`);
    return sendResponse(res, 200, '[DEV] Fake order created (DEV_BYPASS_PAYMENT=true)', {
      orderId:   fakeOrderId,
      amount:    amountPaise,
      currency:  'INR',
      key:       'rzp_test_dev_fake',
      _devMode:  true,
    });
  }

  const order = await razorpayService.createRazorpayOrder({
    amountPaise,
    currency,
    receipt: `receipt_campaign_${campaignId}_${Date.now()}`,
    notes: {
      campaignId: campaignId.toString(),
      userId: req.user.userId.toString()
    }
  });

  sendResponse(res, 200, 'Order created successfully', {
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    key: env.RAZORPAY_KEY_ID,
  });
};

/**
 * Verifies Razorpay payment signature and records the investment
 * @route POST /api/v1/payments/verify
 */
const verifyPayment = async (req, res) => {
  const { userId } = req.user;
  const {
    campaignId,
    amount,
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature
  } = req.body;

  // 1. Verify Signature
  // UPDATED FOR DEPLOYMENT PREP
  // Short-circuit signature check entirely when DEV_BYPASS_PAYMENT is on.
  // CRITICAL: Redundant check for env.isDev to prevent activation in prod.
  let isAuthentic = false;
  if (env.isDev && env.DEV_BYPASS_PAYMENT) {
    isAuthentic = true;
    console.warn('[DEV MODE] DEV_BYPASS_PAYMENT=true — Razorpay signature check skipped.');
  } else if (env.RAZORPAY_KEY_SECRET) {
    const expectedSignature = crypto
      .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');
    isAuthentic = expectedSignature === razorpay_signature;
  }

  if (!isAuthentic) {
    throw new ApiError('Invalid payment signature', 400);
  }

  // 2. Verify Campaign Details Again securely
  const campaign = await Campaign.findById(campaignId);
  if (!campaign) throw new ApiError('Campaign not found.', 404);

  // 3. Idempotency Check on `paymentOrderId`
  const existingOrder = await Investment.findOne({ paymentOrderId: razorpay_order_id });
  if (existingOrder) {
    throw new ApiError(
      `Order ${razorpay_order_id} has already been recorded.`,
      409
    );
  }

  // 4. Record Investment (replicate core functionality of investment.controller.js)
  const isFirstInvestment = !(await Investment.exists({
    campaignId,
    investorUserId: userId,
    status: { $in: ['confirmed', 'unverified'] },
  }));

  const investment = await Investment.create({
    campaignId,
    startupProfileId: campaign.startupProfileId,
    investorUserId: userId,
    amount: amount,
    currency: 'INR',
    status: 'confirmed',
    confirmedAt: new Date(),
    verificationNote: 'Razorpay payment verified',
    paymentOrderId: razorpay_order_id,
    paymentId: razorpay_payment_id,
    paymentProvider: 'razorpay'
  });

  // 5. Update Campaign Totals
  await Campaign.findByIdAndUpdate(campaignId, {
    $inc: {
      currentRaised: amount,
      investorCount: isFirstInvestment ? 1 : 0,
    },
  });

  // UPDATED FOR BLOCKCHAIN TRANSPARENCY LAYER
  // 6. Asynchronously Log to Blockchain (Audit Layer)
  // Ensure failure here doesn't rollback the successful investment.
  const logRes = await blockchainLoggingService.logInvestmentToBlockchain({
    campaignId: campaignId.toString(),
    investorRef: userId.toString(), 
    amount,
    paymentId: razorpay_payment_id,
    paymentProvider: 'razorpay'
  });

  if (logRes.success) {
    await Investment.findByIdAndUpdate(investment._id, {
      blockchainTxHash: logRes.txHash,
      blockchainStatus: 'logged',
      blockNumber: logRes.blockNumber,
      // chainId tracking natively optionally appended here if schema permits, skipped slightly due to strict bounds initially defined
    });
  } else {
    await Investment.findByIdAndUpdate(investment._id, {
      blockchainStatus: 'failed',
      blockchainError: logRes.error
    });
  }

  const populated = await Investment.findById(investment._id)
    .populate('campaignId', 'title fundingGoal currentRaised currency')
    .populate('investorUserId', 'fullName email');

  sendResponse(res, 201, 'Payment verified and investment recorded', {
    investment: populated,
    blockchain: {
      status: logRes.success ? 'logged' : 'failed',
      txHash: logRes.txHash || null,
      blockNumber: logRes.blockNumber || null,
      chainId: logRes.chainId || null,
      error: logRes.error || null
    }
  });
};

module.exports = {
  createOrder,
  verifyPayment
};
