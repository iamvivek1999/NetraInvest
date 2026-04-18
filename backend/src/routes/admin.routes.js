/**
 * src/routes/admin.routes.js
 *
 * Handles admin-only routes (verifications, management).
 * All routes here must be mounted behind the protect and authorize('admin') middleware.
 */

const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { protect, authorize } = require('../middleware/auth');

// Apply protection and authorization to all admin routes
router.use(protect);
router.use(authorize('admin'));

// ─── Analytics & General Dashboard ───────────────────────────────────────────

// Get platform-wide high-level metrics
router.get('/stats', adminController.getDashboardStats);

// ─── User Moderation ─────────────────────────────────────────────────────────

// List all users with filtering/search
router.get('/users', adminController.getUsers);

// Toggle a user's active/deactive status
router.patch('/users/:id/status', adminController.toggleUserStatus);

// Toggle an investor's premium status
router.patch('/investors/:id/premium', adminController.toggleInvestorPremium);

// ─── Compliance Verifications ────────────────────────────────────────────────

// Fetch lists of verifications (e.g. GET /api/v1/admin/verifications/startup?status=pending)
router.get('/verifications/:role', adminController.getVerifications);

// Fetch a single profile for detailed admin review
router.get('/verifications/:role/:id', adminController.getVerificationById);

// Update status (approve/reject/request-info)
router.put('/verifications/:role/:id/status', adminController.updateVerificationStatus);

// ─── Campaigns ─────────────────────────────────────────────────────────────

// Fetch list of campaigns waiting for admin review (submitted/under_review)
router.get('/campaigns', adminController.getCampaignsForReview);

// Update campaign status
router.patch('/campaigns/:id/status', adminController.updateCampaignStatus);

module.exports = router;
