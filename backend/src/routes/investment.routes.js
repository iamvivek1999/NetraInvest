/**
 * src/routes/investment.routes.js
 *
 * Investment routes — Web3-first, Polygon Amoy.
 *
 * Route map:
 *   POST  /api/v1/investments                          → record on-chain investment  (investor)
 *   GET   /api/v1/investments/my                       → investor's own list          (investor)
 *   GET   /api/v1/investments/startup                  → startup portfolio view       (startup)
 *   GET   /api/v1/investments/campaign/:campaignId     → investments for a campaign   (startup/admin)
 *
 * Validation rules:
 *   - txHash: required in on-chain mode (optional only if DEV_STUB_BLOCKCHAIN_MODE=true)
 *   - walletAddress: required in on-chain mode
 *   - currency: POL (on-chain native) or ETH — NOT INR
 *   - paymentProvider / paymentId: REMOVED (Razorpay deprecated to /payments-legacy)
 *
 * Note: env-conditional txHash requirement is partially enforced here and
 * fully enforced in the controller (requireBlockchainOrStub pattern).
 */

const express  = require('express');
const { body, param } = require('express-validator');
const env      = require('../config/env');

const router   = express.Router();
const { protect, authorize }           = require('../middleware/auth');
const { validate }                     = require('../validators/auth.validators');
const {
  recordInvestment,
  getMyInvestments,
  getCampaignInvestments,
  getStartupInvestments,
} = require('../controllers/investment.controller');

// ─── Validation: record investment ───────────────────────────────────────────

const recordInvestmentValidation = [
  body('campaignId')
    .notEmpty()
    .withMessage('campaignId is required')
    .isMongoId()
    .withMessage('campaignId must be a valid MongoDB ObjectId'),

  // txHash: required in blockchain mode; optional only in explicit stub dev mode
  body('txHash')
    .if(() => !env.DEV_STUB_BLOCKCHAIN_MODE)
    .notEmpty()
    .withMessage('txHash is required. Call invest() on the contract first, then send the txHash.')
    .bail()
    .matches(/^0x[a-fA-F0-9]{64}$/)
    .withMessage('txHash must be a valid Ethereum transaction hash (0x + 64 hex chars)'),

  // When stub mode is active — txHash is optional but still validated if provided
  body('txHash')
    .if(() => env.DEV_STUB_BLOCKCHAIN_MODE)
    .optional({ nullable: true })
    .matches(/^0x[a-fA-F0-9]{64}$/)
    .withMessage('txHash must be a valid Ethereum transaction hash (0x + 64 hex chars)'),

  // walletAddress: required in blockchain mode; optional in stub mode
  body('walletAddress')
    .if(() => !env.DEV_STUB_BLOCKCHAIN_MODE)
    .notEmpty()
    .withMessage('walletAddress is required for on-chain investment verification.')
    .bail()
    .matches(/^0x[a-fA-F0-9]{40}$/)
    .withMessage('walletAddress must be a valid Ethereum address (0x + 40 hex chars)'),

  body('walletAddress')
    .if(() => env.DEV_STUB_BLOCKCHAIN_MODE)
    .optional({ nullable: true })
    .matches(/^0x[a-fA-F0-9]{40}$/)
    .withMessage('walletAddress must be a valid Ethereum address (0x + 40 hex chars)'),

  // amount: required in stub mode only (on-chain mode uses chain event amount)
  body('amount')
    .optional()
    .isFloat({ gt: 0 })
    .withMessage('amount must be a positive number'),

  // currency: POL for Polygon Amoy native token — NOT INR
  body('currency')
    .optional()
    .isIn(['POL', 'ETH'])
    .withMessage("currency must be 'POL' (Polygon native) or 'ETH'. Use the correct on-chain currency."),
];

// ─── Validation: campaign investments query ───────────────────────────────────

const campaignIdParam = [
  param('campaignId')
    .isMongoId()
    .withMessage('campaignId must be a valid MongoDB ObjectId'),
];

// ─── Routes ───────────────────────────────────────────────────────────────────

// POST /api/v1/investments
// Records an on-chain investment after frontend tx.wait(1) completes.
// Investor role enforced. txHash required in blockchain mode.
router.post(
  '/',
  protect,
  authorize('investor'),
  recordInvestmentValidation,
  validate,
  recordInvestment
);

// GET /api/v1/investments/my
// Returns the authenticated investor's investment history.
// Note: registered before /campaign/:id so 'my' is not parsed as a param.
router.get(
  '/my',
  protect,
  authorize('investor'),
  getMyInvestments
);

// GET /api/v1/investments/startup
// Returns all investments across the startup's own campaigns (dashboard).
router.get(
  '/startup',
  protect,
  authorize('startup'),
  getStartupInvestments
);

// GET /api/v1/investments/campaign/:campaignId
// Returns investments for a specific campaign.
// Startup can only see their own campaign. Admin can see any.
router.get(
  '/campaign/:campaignId',
  protect,
  campaignIdParam,
  validate,
  getCampaignInvestments
);

module.exports = router;
