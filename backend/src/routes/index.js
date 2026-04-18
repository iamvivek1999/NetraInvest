/**
 * src/routes/index.js
 *
 * Central route registry.
 * All API routes are mounted here and imported into app.js.
 *
 * Pattern: /api/v1/<resource>
 *
 * Add new route files here as features are built.
 * Each router file will be created in src/routes/<resource>.routes.js
 */

const express = require('express');
const router = express.Router();

// ─── Health Check ─────────────────────────────────────────────────────────────
// Always available — used to verify server is running
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Enigma Invest API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// ─── Route Stubs ──────────────────────────────────────────────────────────────
// Uncomment each line as the corresponding route file is created

// Auth routes (register, login)
const authRoutes = require('./auth.routes');
router.use('/auth', authRoutes);

// User profile routes
// const userRoutes = require('./user.routes');
// router.use('/users', userRoutes);

// Startup profile routes
const startupRoutes = require('./startup.routes');
router.use('/startups', startupRoutes);

// Investor profile routes
const investorRoutes = require('./investor.routes');
router.use('/investors', investorRoutes);

// Campaign routes
const campaignRoutes = require('./campaign.routes');
router.use('/campaigns', campaignRoutes);

// Milestone routes are nested inside campaign.routes.js:
//   POST/GET /api/v1/campaigns/:campaignId/milestones
//   GET/PATCH /api/v1/campaigns/:campaignId/milestones/:milestoneId/...
// No separate mount needed here.

// Investment routes
const investmentRoutes = require('./investment.routes');
router.use('/investments', investmentRoutes);

// Payment routes
const paymentRoutes = require('./payment.routes');
router.use('/payments', paymentRoutes);

// Dashboard routes (aggregated views)
// const dashboardRoutes = require('./dashboard.routes');
// router.use('/dashboard', dashboardRoutes);

// Admin routes (protected, Admin dashboard)
const adminRoutes = require('./admin.routes');
router.use('/admin', adminRoutes);

// Progress update routes
// const progressRoutes = require('./progress.routes');
// router.use('/progress', progressRoutes);

module.exports = router;
