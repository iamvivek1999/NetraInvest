/**
 * src/middleware/auth.js
 *
 * JWT authentication middleware and role-based authorization guard.
 *
 * protect      - Verifies JWT, attaches req.user, rejects if invalid/missing
 * optionalAuth - Verifies JWT if present, sets req.user; does NOT reject if missing.
 *                Use on public read routes that also support enriched auth views.
 * authorize    - Factory: returns middleware that checks req.user.role
 *
 * Usage:
 *   router.get('/me',             protect, getMe)
 *   router.get('/campaigns',      optionalAuth, getAllCampaigns)  ← public
 *   router.post('/campaigns',     protect, authorize('startup'), createCampaign)
 *   router.post('/admin/approve', protect, authorize('admin'), approveHandler)
 */

const jwt = require('jsonwebtoken');
const env = require('../config/env');
const User = require('../models/User');
const { ApiError } = require('./errorHandler');

// ─── protect ──────────────────────────────────────────────────────────────────
/**
 * Verifies the Bearer JWT in the Authorization header.
 * On success: attaches decoded payload to req.user and calls next().
 * On failure: throws ApiError 401.
 *
 * req.user shape after protect:
 * {
 *   userId: '...',
 *   role:   'investor' | 'startup' | 'admin',
 *   email:  '...',
 *   iat:    ...,
 *   exp:    ...
 * }
 */
const protect = async (req, res, next) => {
  let token;

  // Extract token from Authorization: Bearer <token>
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    throw new ApiError('Access denied. No token provided.', 401);
  }

  // Verify signature and expiry
  let decoded;
  try {
    decoded = jwt.verify(token, env.JWT_SECRET);
  } catch (err) {
    // JsonWebTokenError and TokenExpiredError are caught by errorHandler.js
    throw err;
  }

  // Verify the user still exists and is active
  // This catches cases where an account was deactivated after token was issued
  const user = await User.findById(decoded.userId).select('_id role email isActive');

  if (!user) {
    throw new ApiError('The user belonging to this token no longer exists.', 401);
  }

  if (!user.isActive) {
    throw new ApiError('Your account has been deactivated. Please contact support.', 401);
  }

  // Attach full decoded payload to req.user
  // Use decoded (not DB user) to avoid extra field overhead on every request
  req.user = decoded;

  next();
};

// ─── authorize ────────────────────────────────────────────────────────────────
/**
 * Role-based access control middleware factory.
 * Must be used AFTER protect (requires req.user to be set).
 *
 * @param {...string} roles - Allowed roles for this route
 * @returns {Function} Express middleware
 *
 * Example:
 *   authorize('startup')          → only startups allowed
 *   authorize('admin')            → only admins allowed
 *   authorize('investor', 'admin') → both allowed
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      throw new ApiError('Authentication required.', 401);
    }

    if (!roles.includes(req.user.role)) {
      throw new ApiError(
        `Access denied. This route requires one of the following roles: ${roles.join(', ')}`,
        403
      );
    }

    next();
  };
};

// ─── optionalAuth ─────────────────────────────────────────────────────────────
/**
 * Soft authentication — attaches req.user if a valid Bearer token is present,
 * continues without setting req.user if no token or token is invalid.
 *
 * Use on routes that are publicly readable but can also have auth-context
 * behaviour (e.g. showing an "invest" button if the viewer is logged in).
 *
 * Note: JWT decode errors are silently swallowed so public users aren't
 * blocked by an expired/malformed token.
 */
const optionalAuth = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return next();

  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    const user    = await User.findById(decoded.userId).select('_id role email isActive');
    if (user && user.isActive) {
      req.user = decoded;
    }
  } catch {
    // Ignore invalid / expired tokens — treat request as anonymous
  }
  next();
};

module.exports = { protect, optionalAuth, authorize };
