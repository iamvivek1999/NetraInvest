/**
 * src/middleware/validateRequest.js
 *
 * Reads the result of express-validator checks and returns a 422 response
 * if any validation errors are present, otherwise calls next().
 */

const { validationResult } = require('express-validator');
const { ApiError } = require('./errorHandler');

const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const message = errors
      .array()
      .map((e) => e.msg)
      .join(', ');
    throw new ApiError(message, 422);
  }
  next();
};

module.exports = validateRequest;
