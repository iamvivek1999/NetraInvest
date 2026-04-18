/**
 * src/routes/investor.routes.js
 *
 * Investor profile routes.
 *
 * IMPORTANT: /me MUST come before /:id so Express doesn't parse "me" as a MongoDB ObjectId.
 *
 * Route map:
 *   POST   /api/v1/investors       → create investor profile  (investor only)
 *   GET    /api/v1/investors/me    → own profile + summary    (investor only)
 *   PATCH  /api/v1/investors/me    → update own profile       (investor only)
 *   GET    /api/v1/investors/:id   → public profile view      (any authenticated user)
 */

const express = require('express');
const router = express.Router();

const {
  createProfile,
  getMyProfile,
  updateProfile,
  getProfile,
} = require('../controllers/investor.controller');

const { protect, authorize } = require('../middleware/auth');

// ── Create profile ─────────────────────────────────────────────────────────────
router.post('/', protect, authorize('investor'), createProfile);

// ── /me routes — MUST come before /:id ────────────────────────────────────────
router.get('/me', protect, authorize('investor'), getMyProfile);
router.patch('/me', protect, authorize('investor'), updateProfile);

// ── Single profile (public) ───────────────────────────────────────────────────
router.get('/:id', protect, getProfile);

module.exports = router;
