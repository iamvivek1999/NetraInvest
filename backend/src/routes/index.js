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

// DEPRECATED: Razorpay off-chain payment flow.
// Route renamed to /payments-legacy — do not use for new investments.
// Use POST /api/v1/investments with a verified on-chain txHash instead.
const paymentRoutes = require('./payment.routes');
router.use('/payments-legacy', paymentRoutes);

// Dashboard routes (aggregated views)
// const dashboardRoutes = require('./dashboard.routes');
// router.use('/dashboard', dashboardRoutes);

// Admin routes (protected, Admin dashboard)
const adminRoutes = require('./admin.routes');
router.use('/admin', adminRoutes);

// Proof document routes
// GET  /api/v1/milestones/:milestoneId/proof-summary
// GET  /api/v1/milestones/:milestoneId/proof-documents
// POST /api/v1/milestones/:milestoneId/proof-documents
// PATCH /api/v1/milestones/:milestoneId/proof-documents/:docId/summary
const proofDocumentRoutes = require('./proofDocument.routes');
router.use('/milestones', proofDocumentRoutes);

// Notification routes
// GET  /api/v1/notifications
// GET  /api/v1/notifications/unread-count
// PATCH /api/v1/notifications/read-all
// PATCH /api/v1/notifications/:id/read
const notificationRoutes = require('./notification.routes');
router.use('/notifications', notificationRoutes);

// Evidence file-serving routes (global, bundleId-based)
// GET  /api/v1/evidence/files/:bundleId/:fileIndex   → stream an uploaded file
// GET  /api/v1/evidence/files/:bundleId/summary      → stream summary.json
const { evidenceFileRouter } = require('./milestoneEvidence.routes');
router.use('/evidence', evidenceFileRouter);

// Progress update routes
// const progressRoutes = require('./progress.routes');
// router.use('/progress', progressRoutes);

module.exports = router;
