/**
 * src/routes/investment.routes.js
 *
 * Investment routes.
 *
 * IMPORTANT route ordering:
 *   /my, /startup, /campaign/:campaignId must all be registered BEFORE
 *   any /:investmentId route (which doesn't exist yet, but kept for future-proofing).
 *   Express matches left-to-right; literal path segments beat named params.
 *
 * Route map:
 *   POST  /api/v1/investments                          → record investment        (investor)
 *   GET   /api/v1/investments/my                       → investor's own list      (investor)
 *   GET   /api/v1/investments/startup                  → startup portfolio view   (startup)
 *   GET   /api/v1/investments/campaign/:campaignId     → investments for a campaign (startup/admin)
 *
 * Access:
 *   All routes require authentication (protect middleware).
 *   Role-specific access is enforced in the controller (not via authorize middleware)
 *   because getCampaignInvestments accepts both startup and admin roles.
 */

const express  = require('express');
const { body, param } = require('express-validator');

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

  body('txHash')
    .optional({ nullable: true })
    .matches(/^0x[a-fA-F0-9]{64}$/)
    .withMessage('txHash must be a valid Ethereum transaction hash (0x + 64 hex chars)'),

  // UPDATED FOR NON-BLOCKCHAIN PAYMENT FLOW
  body('walletAddress')
    .optional({ nullable: true })
    .matches(/^0x[a-fA-F0-9]{40}$/)
    .withMessage('walletAddress must be a valid Ethereum address (0x + 40 hex chars)'),

  body('paymentId').optional(),
  body('paymentProvider').optional(),

  body('amount')
    .optional()
    .isFloat({ gt: 0 })
    .withMessage('amount must be a positive number'),

  body('currency')
    .optional()
    .isIn(['INR', 'ETH'])
    .withMessage('currency must be INR or ETH'),
];

// ─── Validation: campaign investments query ───────────────────────────────────

const campaignIdParam = [
  param('campaignId')
    .isMongoId()
    .withMessage('campaignId must be a valid MongoDB ObjectId'),
];

// ─── Routes ───────────────────────────────────────────────────────────────────

// POST /api/v1/investments
// Records an investment after frontend tx.wait() completes.
// Investor role enforced.
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
// Note: registered before /campaign/:id so 'my' isn't parsed as a param.
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
