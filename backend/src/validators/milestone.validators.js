/**
 * src/validators/milestone.validators.js
 */

const { body } = require('express-validator');

// ─── Batch Create Milestones ──────────────────────────────────────────────────
/**
 * Validates the milestones array sent to:
 * POST /api/v1/campaigns/:campaignId/milestones
 *
 * Each element needs title + description.
 * Percentages are taken from the campaign model — NOT sent by the client.
 */
const createMilestonesValidation = [
  body('milestones')
    .notEmpty().withMessage('milestones array is required')
    .isArray({ min: 1, max: 5 })
    .withMessage('milestones must be an array of 1 to 5 items'),

  body('milestones.*.title')
    .trim()
    .notEmpty().withMessage('Each milestone must have a title')
    .isLength({ max: 120 }).withMessage('Milestone title cannot exceed 120 characters'),

  body('milestones.*.description')
    .trim()
    .notEmpty().withMessage('Each milestone must have a description')
    .isLength({ min: 20, max: 1000 })
    .withMessage('Milestone description must be between 20 and 1000 characters'),

  body('milestones.*.targetDate')
    .optional({ nullable: true })
    .isISO8601().withMessage('targetDate must be a valid ISO8601 date'),
];

// ─── Submit Proof ─────────────────────────────────────────────────────────────
/**
 * Validates proof submission payload:
 * PATCH /api/v1/campaigns/:campaignId/milestones/:milestoneId/submit
 */
const submitProofValidation = [
  body('description')
    .trim()
    .notEmpty().withMessage('Proof description is required')
    .isLength({ min: 20, max: 2000 })
    .withMessage('Proof description must be between 20 and 2000 characters'),

  body('proofLinks')
    .optional()
    .isArray({ max: 10 }).withMessage('proofLinks must be an array of up to 10 URLs'),

  body('proofLinks.*')
    .optional()
    .isString().trim()
    .notEmpty().withMessage('Each proof link must be a non-empty string'),

  body('documents')
    .optional()
    .isArray({ max: 5 }).withMessage('documents must be an array of up to 5 items'),

  body('documents.*.url')
    .if(body('documents').exists())
    .notEmpty().withMessage('Each document must have a URL')
    .trim(),

  body('documents.*.label')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 100 }).withMessage('Document label cannot exceed 100 characters'),
];

// ─── Approve Milestone ────────────────────────────────────────────────────────
/**
 * Validates admin approval payload:
 * PATCH /api/v1/campaigns/:campaignId/milestones/:milestoneId/approve
 *
 * No required body fields — approval is an action, not a data submission.
 * Optional: note from admin (stored for audit)
 */
const approveMilestoneValidation = [
  body('note')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 500 }).withMessage('Approval note cannot exceed 500 characters'),
];

// ─── Reject Milestone ─────────────────────────────────────────────────────────
/**
 * Validates admin rejection payload:
 * PATCH /api/v1/campaigns/:campaignId/milestones/:milestoneId/reject
 */
const rejectMilestoneValidation = [
  body('rejectionReason')
    .trim()
    .notEmpty().withMessage('Rejection reason is required')
    .isLength({ max: 500 }).withMessage('Rejection reason cannot exceed 500 characters'),
];

module.exports = {
  createMilestonesValidation,
  submitProofValidation,
  approveMilestoneValidation,
  rejectMilestoneValidation,
};
