/**
 * src/validators/auth.validators.js
 *
 * Input validation rules for auth endpoints using express-validator.
 * Applied as route-level middleware before controllers are invoked.
 *
 * Usage in routes:
 *   router.post('/register', registerValidation, validate, controller)
 */

const { body, validationResult } = require('express-validator');
const { ApiError } = require('../middleware/errorHandler');

// ─── Validation Rule Sets ─────────────────────────────────────────────────────

/**
 * Rules for POST /api/v1/auth/register
 */
const registerValidation = [
  body('fullName')
    .trim()
    .notEmpty().withMessage('Full name is required')
    .isLength({ min: 2, max: 80 }).withMessage('Full name must be between 2 and 80 characters'),

  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email address')
    .normalizeEmail(),

  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number'),

  body('role')
    .notEmpty().withMessage('Role is required')
    .isIn(['investor', 'startup']).withMessage('Role must be either "investor" or "startup"'),
    // Note: 'admin' role is NOT allowed via public registration
];

/**
 * Rules for POST /api/v1/auth/login
 */
const loginValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email address')
    .normalizeEmail(),

  body('password')
    .notEmpty().withMessage('Password is required'),

  // Optional: if the frontend sends a role, validate it's a known value.
  // The controller will verify it matches the stored role.
  body('role')
    .optional()
    .isIn(['investor', 'startup', 'admin'])
    .withMessage('Role must be either "investor", "startup" or "admin"'),
];

/**
 * Rules for PATCH /api/v1/auth/wallet
 * Links a wallet address to the authenticated user's account
 */
const walletValidation = [
  body('walletAddress')
    .notEmpty().withMessage('Wallet address is required')
    .matches(/^0x[a-fA-F0-9]{40}$/).withMessage('Invalid Ethereum wallet address format'),
];

// ─── Validation Error Handler Middleware ──────────────────────────────────────

/**
 * Checks express-validator results and throws ApiError if any rule failed.
 * Must be placed AFTER the validation rule arrays in the route middleware chain.
 *
 * @throws {ApiError} 422 with array of validation error messages
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const messages = errors.array().map((e) => e.msg);
    throw new ApiError(messages.join('. '), 422);
  }
  next();
};

module.exports = {
  registerValidation,
  loginValidation,
  walletValidation,
  validate,
};
