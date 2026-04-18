/**
 * src/validators/campaign.validators.js
 *
 * Validation rules for campaign endpoints.
 *
 * Key constraint: milestonePercentages must sum to 100
 * and must have exactly milestoneCount elements.
 * This is validated here at the API layer AND enforced by the model.
 */

const { body } = require('express-validator');

const VALID_CURRENCIES = ['INR', 'ETH'];
const VALID_STATUSES_FOR_UPDATE = ['draft', 'submitted', 'under_review', 'approved', 'rejected', 'active', 'paused', 'cancelled'];
// 'funded' and 'completed' are system-set — never allowed via client update

// ─── Create Campaign Validation ───────────────────────────────────────────────

const createCampaignValidation = [
  body('title')
    .trim()
    .notEmpty().withMessage('Campaign title is required')
    .isLength({ max: 120 }).withMessage('Title cannot exceed 120 characters'),

  body('summary')
    .trim()
    .notEmpty().withMessage('Campaign summary is required')
    .isLength({ min: 30, max: 500 })
    .withMessage('Summary must be between 30 and 500 characters'),

  body('fundingGoal')
    .notEmpty().withMessage('Funding goal is required')
    .isFloat({ min: 0.001 }).withMessage('Funding goal must be greater than 0'),

  body('currency')
    .optional()
    .isIn(VALID_CURRENCIES)
    .withMessage(`Currency must be one of: ${VALID_CURRENCIES.join(', ')}`),

  body('minInvestment')
    .optional()
    .isFloat({ min: 0.001 }).withMessage('Minimum investment must be greater than 0'),

  body('maxInvestment')
    .optional({ nullable: true })
    .isFloat({ min: 0.001 }).withMessage('Maximum investment must be greater than 0'),

  body('deadline')
    .notEmpty().withMessage('Campaign deadline is required')
    .isISO8601().withMessage('Deadline must be a valid date (ISO8601 format)')
    .custom((value) => {
      const deadline = new Date(value);
      const now = new Date();
      const minDuration = new Date(now.getTime() + 24 * 60 * 60 * 1000); // at least 24h from now
      if (deadline <= minDuration) {
        throw new Error('Deadline must be at least 24 hours from now');
      }
      return true;
    }),

  body('milestoneCount')
    .notEmpty().withMessage('Number of milestones is required')
    .isInt({ min: 1, max: 5 })
    .withMessage('Milestone count must be between 1 and 5'),

  body('milestonePercentages')
    .notEmpty().withMessage('Milestone percentages are required')
    .isArray({ min: 1, max: 5 }).withMessage('milestonePercentages must be an array')
    .custom((arr, { req }) => {
      // Check array length matches milestoneCount
      const count = parseInt(req.body.milestoneCount, 10);
      if (arr.length !== count) {
        throw new Error(
          `milestonePercentages must have exactly ${count} element(s) to match milestoneCount`
        );
      }
      // Check all values are positive numbers
      if (!arr.every((v) => typeof v === 'number' && v > 0)) {
        throw new Error('Each milestone percentage must be a positive number');
      }
      // Check sum equals 100
      const sum = arr.reduce((acc, v) => acc + v, 0);
      if (Math.abs(sum - 100) >= 0.001) {
        throw new Error(`Milestone percentages must sum to 100 (current sum: ${sum})`);
      }
      return true;
    }),

  body('tags')
    .optional()
    .isArray({ max: 10 }).withMessage('Tags must be an array of up to 10 items'),

  body('tags.*')
    .optional()
    .isString().trim()
    .isLength({ max: 30 }).withMessage('Each tag cannot exceed 30 characters'),

  body('sector')
    .notEmpty().withMessage('Sector is required')
    .isString(),

  body('category')
    .notEmpty().withMessage('Category is required')
    .isString(),

  body('fundingStage')
    .notEmpty().withMessage('Funding stage is required')
    .isIn(['pre-seed', 'seed', 'series-a', 'series-b', 'series-c', 'growth'])
    .withMessage('Invalid funding stage'),

  body('riskScore')
    .notEmpty().withMessage('Risk score is required')
    .isInt({ min: 1, max: 10 }).withMessage('Risk score must be between 1 and 10'),

  body('returnPotential')
    .notEmpty().withMessage('Return potential is required')
    .isIn(['low', 'medium', 'high', 'moonshot'])
    .withMessage('Invalid return potential'),
];

// ─── Update Campaign Validation ───────────────────────────────────────────────
// All fields optional — only validate provided fields

const updateCampaignValidation = [
  body('title')
    .optional()
    .trim()
    .isLength({ max: 120 }).withMessage('Title cannot exceed 120 characters'),

  body('summary')
    .optional()
    .trim()
    .isLength({ min: 30, max: 500 })
    .withMessage('Summary must be between 30 and 500 characters'),

  body('fundingGoal')
    .optional()
    .isFloat({ min: 0.001 }).withMessage('Funding goal must be greater than 0'),

  body('currency')
    .optional()
    .isIn(VALID_CURRENCIES)
    .withMessage(`Currency must be one of: ${VALID_CURRENCIES.join(', ')}`),

  body('minInvestment')
    .optional()
    .isFloat({ min: 0.001 }).withMessage('Minimum investment must be greater than 0'),

  body('maxInvestment')
    .optional({ nullable: true })
    .isFloat({ min: 0.001 }).withMessage('Maximum investment must be greater than 0'),

  body('deadline')
    .optional()
    .isISO8601().withMessage('Deadline must be a valid date')
    .custom((value) => {
      const deadline = new Date(value);
      const minDuration = new Date(Date.now() + 24 * 60 * 60 * 1000);
      if (deadline <= minDuration) {
        throw new Error('Deadline must be at least 24 hours from now');
      }
      return true;
    }),

  body('status')
    .optional()
    .isIn(VALID_STATUSES_FOR_UPDATE)
    .withMessage(
      `Status can only be set to: ${VALID_STATUSES_FOR_UPDATE.join(', ')} — "funded" and "completed" are system-set`
    ),

  body('milestoneCount')
    .optional()
    .isInt({ min: 1, max: 5 }).withMessage('Milestone count must be between 1 and 5'),

  body('milestonePercentages')
    .optional()
    .isArray({ min: 1, max: 5 })
    .custom((arr, { req }) => {
      if (!arr) return true;
      const count = parseInt(req.body.milestoneCount, 10);
      // Only validate length match if milestoneCount is also being updated
      if (!isNaN(count) && arr.length !== count) {
        throw new Error('milestonePercentages length must match milestoneCount');
      }
      if (!arr.every((v) => typeof v === 'number' && v > 0)) {
        throw new Error('Each milestone percentage must be a positive number');
      }
      const sum = arr.reduce((acc, v) => acc + v, 0);
      if (Math.abs(sum - 100) >= 0.001) {
        throw new Error(`Milestone percentages must sum to 100 (current sum: ${sum})`);
      }
      return true;
    }),

  body('tags')
    .optional()
    .isArray({ max: 10 }),

  body('tags.*')
    .optional()
    .isString().trim()
    .isLength({ max: 30 }),
];

module.exports = {
  createCampaignValidation,
  updateCampaignValidation,
};
