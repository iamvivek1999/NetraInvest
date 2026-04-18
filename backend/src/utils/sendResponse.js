/**
 * src/utils/sendResponse.js
 *
 * Standardized API response helper.
 * Ensures all responses follow the same shape throughout the API.
 *
 * Success shape:
 * {
 *   success: true,
 *   message: "...",
 *   data: { ... },      // optional
 *   token: "...",       // only on auth responses
 *   meta: { ... }       // optional pagination / extras
 * }
 *
 * Error shape is handled by errorHandler.js middleware.
 */

/**
 * Send a standardized success response.
 *
 * @param {Object}  res        - Express response object
 * @param {number}  statusCode - HTTP status code (default: 200)
 * @param {string}  message    - Human-readable message
 * @param {*}       data       - Response payload (optional)
 * @param {Object}  extras     - Additional top-level keys (e.g. { token })
 */
const sendResponse = (res, statusCode = 200, message = 'Success', data = null, extras = {}) => {
  const body = {
    success: true,
    message,
    ...extras,
  };

  if (data !== null) {
    body.data = data;
  }

  return res.status(statusCode).json(body);
};

module.exports = sendResponse;
