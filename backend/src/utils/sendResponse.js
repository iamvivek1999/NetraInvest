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
 * Send a standardized API response.
 *
 * @param {Object}  res        - Express response object
 * @param {number}  statusCode - HTTP status code (default: 200)
 * @param {string|boolean} messageOrSuccess - Human-readable message OR success boolean
 * @param {*}       messageOrData    - Human-readable message (if 3rd was boolean) OR data payload
 * @param {*}       dataOrExtras     - Data payload (if 3rd/4th were different) OR extras
 */
const sendResponse = (res, statusCode = 200, messageOrSuccess = 'Success', messageOrData = null, dataOrExtras = null) => {
  let success = statusCode < 400;
  let message = '';
  let data = null;
  let extras = {};

  // Handle (res, statusCode, success, message, data, extras)
  if (typeof messageOrSuccess === 'boolean') {
    success = messageOrSuccess;
    message = typeof messageOrData === 'string' ? messageOrData : (success ? 'Success' : 'Error');
    data = dataOrExtras;
    // Note: extras would be a 6th arg, but let's keep it simple or use data if it's an object
  } 
  // Handle (res, statusCode, message, data, extras)
  else {
    message = messageOrSuccess;
    data = messageOrData;
    extras = dataOrExtras || {};
  }

  const body = {
    success,
    message,
    ...extras,
  };

  if (data !== null) {
    if (typeof data === 'object' && !Array.isArray(data) && Object.keys(extras).length === 0) {
       // if data is object, maybe it has extras? No, let's stick to the structure.
       body.data = data;
    } else {
       body.data = data;
    }
  }

  return res.status(statusCode).json(body);
};

module.exports = sendResponse;
