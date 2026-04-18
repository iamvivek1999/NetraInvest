/**
 * src/utils/generateToken.js
 *
 * JWT token generation utility.
 * Encodes userId, role, and email into a signed token.
 *
 * Payload is intentionally minimal:
 *  - userId  → identify the user
 *  - role    → authorize without DB lookup on every request
 *  - email   → useful for display without DB call
 *
 * Do NOT put sensitive data (password hash, wallet key) in the payload.
 */

const jwt = require('jsonwebtoken');
const env = require('../config/env');

/**
 * Generate a signed JWT token for a user.
 *
 * @param {Object} user - Mongoose user document
 * @param {string} user._id
 * @param {string} user.role
 * @param {string} user.email
 * @returns {string} Signed JWT token
 */
const generateToken = (user) => {
  const payload = {
    userId: user._id.toString(),
    role: user.role,
    email: user.email,
  };

  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRE, // e.g. '7d'
  });
};

module.exports = generateToken;
