/**
 * src/routes/campaign.routes.js
 *
 * Campaign routes — also hosts nested milestone sub-routes.
 *
 * IMPORTANT: /my MUST be registered before /:campaignId
 * Same reason as startup /me — Express would treat "my" as an ObjectId otherwise.
 *
 * Route map:
 *   POST   /api/v1/campaigns                                 → create campaign        (startup)
 *   GET    /api/v1/campaigns                                 → list all               (any)
 *   GET    /api/v1/campaigns/my                              → own campaigns          (startup)
 *   GET    /api/v1/campaigns/:campaignId                     → single campaign        (any)
 *   PATCH  /api/v1/campaigns/:campaignId                     → update campaign        (startup)
 *   POST   /api/v1/campaigns/:campaignId/activate            → activate on-chain      (startup)
 *
 * Nested milestones (mounted below, from milestone.routes.js):
 *   POST   /api/v1/campaigns/:campaignId/milestones          → batch create           (startup)
 *   GET    /api/v1/campaigns/:campaignId/milestones          → list milestones        (any)
 *   GET    /api/v1/campaigns/:campaignId/milestones/:id      → single milestone       (any)
 *   PATCH  /api/v1/campaigns/:campaignId/milestones/:id/submit   → submit proof       (startup)
 *   PATCH  /api/v1/campaigns/:campaignId/milestones/:id/approve  → approve            (admin)
 *   PATCH  /api/v1/campaigns/:campaignId/milestones/:id/reject   → reject             (admin)
 *   PATCH  /api/v1/campaigns/:campaignId/milestones/:id/release  → release on-chain   (admin)
 */
const express = require('express');
const router = express.Router();

const {
  createCampaign,
  submitCampaign,
  activateCampaign,
  updateCampaign,
  getCampaign,
  getAllCampaigns,
  getMyCampaigns,
} = require('../controllers/campaign.controller');

const { protect, optionalAuth, authorize, requireStartupVerified } = require('../middleware/auth');

const {
  createCampaignValidation,
  updateCampaignValidation,
} = require('../validators/campaign.validators');

const { validate } = require('../validators/auth.validators');

// ── Collection routes ─────────────────────────────────────────────────────────

router
  .route('/')
  .post(protect, authorize('startup'), requireStartupVerified, createCampaignValidation, validate, createCampaign)
  .get(optionalAuth, getAllCampaigns);  // public read


// ── /my MUST come before /:id ─────────────────────────────────────────────────

router.get('/my', protect, authorize('startup'), getMyCampaigns);

// ── Single resource routes ────────────────────────────────────────────────────

// Use :campaignId consistently for both the campaign resource and nested milestone routes.
// This makes req.params.campaignId available in the milestone router (mergeParams: true).

router
  .route('/:campaignId')
  .get(optionalAuth, getCampaign)      // public read
  .patch(protect, authorize('startup'), updateCampaignValidation, validate, updateCampaign);

// ── Submit Campaign (Request review) ──────────────────────────────────────────
router.post(
  '/:campaignId/submit',
  protect,
  authorize('startup'),
  submitCampaign
);


// ── Activate Campaign (on-chain registration) ─────────────────────────────────
// Must be after /:campaignId so Express doesn't interpret 'activate' as a campaignId.
// Express matches /my and /:campaignId/activate before /:campaignId due to path specificity.

router.post(
  '/:campaignId/activate',
  protect,
  authorize('startup'),
  activateCampaign
);

// ── Nested: Milestone sub-routes ──────────────────────────────────────────────
// milestone.routes.js uses mergeParams: true, which makes req.params.campaignId
// available from this parent router's /:campaignId segment.

const milestoneRouter = require('./milestone.routes');
router.use('/:campaignId/milestones', milestoneRouter);

module.exports = router;
