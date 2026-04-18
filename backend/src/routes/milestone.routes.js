/**
 * src/routes/milestone.routes.js
 *
 * Milestone routes — mounted as nested routes under campaigns.
 * Mount point (in campaign.routes.js):
 *   router.use('/:campaignId/milestones', milestoneRouter)
 *
 * mergeParams: true  →  req.params.campaignId is available in this router
 *
 * Route map (all prefixed by /api/v1/campaigns/:campaignId/milestones):
 *   POST   /                      → batch create milestones  (startup only)
 *   GET    /                      → list milestones           (any user)
 *   GET    /:milestoneId          → single milestone          (any user)
 *   PATCH  /:milestoneId/submit   → submit proof              (startup only)
 *   PATCH  /:milestoneId/approve  → approve — off-chain review (admin only)
 *   PATCH  /:milestoneId/reject   → reject with reason        (admin only)
 *   PATCH  /:milestoneId/disburse → disburse — financial event off-chain (admin only)
 *                                   advances currentMilestoneIndex,
 *                                   marks campaign 'completed' if final milestone
 */

const express = require('express');

// mergeParams: true — inherit campaignId from parent router params
const router = express.Router({ mergeParams: true });

const {
  createMilestones,
  getMilestones,
  getMilestone,
  submitProof,
  approveMilestone,
  rejectMilestone,
  markDisbursed,
} = require('../controllers/milestone.controller');

const { protect, optionalAuth, authorize } = require('../middleware/auth');


const {
  createMilestonesValidation,
  submitProofValidation,
  approveMilestoneValidation,
  rejectMilestoneValidation,
} = require('../validators/milestone.validators');

const { validate } = require('../validators/auth.validators');

// ── Collection ────────────────────────────────────────────────────────────────

router
  .route('/')
  .post(protect, authorize('startup'), createMilestonesValidation, validate, createMilestones)
  .get(optionalAuth, getMilestones);    // public read


// ── Single milestone ──────────────────────────────────────────────────────────

router.get('/:milestoneId', optionalAuth, getMilestone); // public read


// ── Lifecycle actions ─────────────────────────────────────────────────────────

// Startup submits proof for the current milestone
router.patch(
  '/:milestoneId/submit',
  protect,
  authorize('startup'),
  submitProofValidation,
  validate,
  submitProof
);

// Admin approves submitted proof (no UI — Postman / internal API only)
router.patch(
  '/:milestoneId/approve',
  protect,
  authorize('admin'),
  approveMilestoneValidation,
  validate,
  approveMilestone
);

// Admin rejects submitted proof with a reason
router.patch(
  '/:milestoneId/reject',
  protect,
  authorize('admin'),
  rejectMilestoneValidation,
  validate,
  rejectMilestone
);

// Admin disburses funds for an approved milestone strictly natively offline.
// This is where currentMilestoneIndex advances explicitly tracking manually verified payments.
router.patch(
  '/:milestoneId/disburse',
  protect,
  authorize('admin'),
  markDisbursed
);

module.exports = router;
