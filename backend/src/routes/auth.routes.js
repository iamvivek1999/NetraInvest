/**
 * src/routes/auth.routes.js
 *
 * Auth routes — public and protected endpoints.
 *
 * Public:
 *   POST /api/v1/auth/register  → create account
 *   POST /api/v1/auth/login     → authenticate
 *
 * Protected (requires valid JWT):
 *   GET   /api/v1/auth/me       → get current user
 *   PATCH /api/v1/auth/wallet   → link wallet address
 */

const express = require('express');
const router = express.Router();

const { register, login, getMe, linkWallet, logout } = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth');
const {
  registerValidation,
  loginValidation,
  walletValidation,
  validate,
} = require('../validators/auth.validators');

// ── Public routes ─────────────────────────────────────────────────────────────

router.post('/register', registerValidation, validate, register);
router.post('/login', loginValidation, validate, login);

// ── Protected routes ──────────────────────────────────────────────────────────

router.get('/me', protect, getMe);
router.patch('/wallet', protect, walletValidation, validate, linkWallet);
router.post('/logout', protect, logout);

module.exports = router;
