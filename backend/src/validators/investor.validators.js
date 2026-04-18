const { body, validationResult } = require('express-validator');
const { ApiError } = require('../middleware/errorHandler');

/**
 * Validation rules for modifying an investor profile.
 */
const profileValidation = [
  body('firstName').optional().trim().isLength({ min: 2, max: 50 }).withMessage('First name must be between 2 and 50 characters'),
  body('lastName').optional().trim().isLength({ min: 2, max: 50 }).withMessage('Last name must be between 2 and 50 characters'),
  
  body('phone').optional().trim().notEmpty().withMessage('Phone cannot be empty if provided'),
  
  body('riskAppetite')
    .optional()
    .isIn(['low', 'medium', 'high'])
    .withMessage('Risk appetite must be one of: low, medium, high'),

  body('preferredSectors')
    .optional()
    .isArray()
    .withMessage('Preferred sectors must be an array of strings'),
  
  body('preferredSectors.*')
    .optional()
    .isString()
    .withMessage('Each preferred sector must be a string'),

  body('investmentRange.min')
    .optional()
    .isNumeric()
    .withMessage('Investment Range Min must be a number')
    .custom((value, { req }) => {
      if (value < 0) throw new Error('Investment Range Min cannot be negative');
      const max = req.body.investmentRange?.max;
      if (max !== undefined && value > max) {
        throw new Error('Investment Range Min cannot be greater than Max');
      }
      return true;
    }),

  body('investmentRange.max')
    .optional()
    .isNumeric()
    .withMessage('Investment Range Max must be a number'),
];

/**
 * Checks express-validator results and throws ApiError if any rule failed.
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
  profileValidation,
  validate,
};
