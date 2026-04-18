/**
 * src/routes/startup.routes.js
 *
 * Startup profile routes.
 *
 * IMPORTANT: /me MUST be registered before /:id
 * Express matches routes in order — if /:id comes first,
 * the string "me" will be treated as a MongoDB ObjectId and fail.
 *
 * Route map:
 *   POST   /api/v1/startups          → create profile   (startup only)
 *   GET    /api/v1/startups          → list all          (any user)
 *   GET    /api/v1/startups/me       → own profile       (startup only)
 *   GET    /api/v1/startups/:id      → single profile    (any user)
 *   PATCH  /api/v1/startups/:id      → update profile    (startup only, own)
 */

const express = require('express');
const router = express.Router();

const {
  createProfile,
  updateProfile,
  getMyProfile,
  getProfile,
  getAllProfiles,
  submitProfile,
  getVerificationStatus,
} = require('../controllers/startup.controller');

const { protect, authorize } = require('../middleware/auth');

const {
  createProfileValidation,
  updateProfileValidation,
} = require('../validators/startup.validators');

const { validate } = require('../validators/auth.validators');

// ── Collection routes ─────────────────────────────────────────────────────────

router
  .route('/')
  .post(protect, authorize('startup'), createProfileValidation, validate, createProfile)
  .get(protect, getAllProfiles);

// ── /me MUST come before /:id ─────────────────────────────────────────────────

router.get('/me', protect, authorize('startup'), getMyProfile);

// POST /submit — must also come before /:id ("submit" is a fixed segment not an ObjectId)
router.post('/submit', protect, authorize('startup'), submitProfile);

// GET /verification-status - fixed segment
router.get('/verification-status', protect, authorize('startup'), getVerificationStatus);


// ── Single resource routes ────────────────────────────────────────────────────

router
  .route('/:id')
  .get(protect, getProfile)
  .patch(protect, authorize('startup'), updateProfileValidation, validate, updateProfile);

module.exports = router;
