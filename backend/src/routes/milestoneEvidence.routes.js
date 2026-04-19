/**
 * src/routes/milestoneEvidence.routes.js
 *
 * Routes for milestone evidence upload, on-chain anchoring, and admin review.
 *
 * Two mount points (registered in routes/index.js):
 *
 * ── A. Nested under campaigns/:campaignId (milestone-context operations) ───────
 *
 *   POST   /api/v1/campaigns/:id/milestones/:idx/evidence/upload
 *     → Upload 1-10 files; processes locally, auto-anchors hashes on-chain.
 *     → Returns evidenceHash + summaryHash + onChainStatus + submitTxHash.
 *
 *   GET    /api/v1/campaigns/:id/milestones/:idx/evidence
 *     → List all bundles for this milestone (latest first, no raw paths).
 *
 *   GET    /api/v1/campaigns/:id/milestones/:idx/evidence/latest
 *     → Most recent bundle with full on-chain status and file serve URLs.
 *
 *   POST   /api/v1/campaigns/:id/milestones/:idx/evidence/anchor
 *     → Admin: manually re-trigger anchor (recovery / forced re-submit).
 *
 *   POST   /api/v1/campaigns/:id/milestones/:idx/evidence/approve
 *     → Admin: call approveMilestoneEvidence() on-chain.
 *     → Body: {} (no body required)
 *
 *   POST   /api/v1/campaigns/:id/milestones/:idx/evidence/reject
 *     → Admin: call rejectMilestoneEvidence() on-chain.
 *     → Body: { reason: "..." }
 *
 *   POST   /api/v1/campaigns/:id/milestones/:idx/evidence/release
 *     → Admin: call releaseMilestone() on-chain (transfers funds to startup wallet).
 *
 * ── B. Global file-serving (bundleId-based) ───────────────────────────────────
 *   Mounted at /api/v1/evidence by routes/index.js.
 *
 *   GET    /api/v1/evidence/files/:bundleId/summary
 *     → Stream summary.json for a bundle (authenticated).
 *
 *   GET    /api/v1/evidence/files/:bundleId/:fileIndex
 *     → Stream uploaded file at position fileIndex (authenticated).
 *
 * Security:
 *   - All routes require protect (JWT auth).
 *   - Upload and Anchor require startup/admin role.
 *   - Approve / Reject / Release require admin role.
 *   - File serving checks campaign ownership (admin bypasses).
 *   - Multer errors are caught by wrapMulterError before reaching controllers.
 */

'use strict';

const express = require('express');

const {
  uploadEvidence,
  listBundles,
  getLatestBundle,
  triggerAnchor,
  approveEvidence,
  rejectEvidence,
  releaseMilestoneFunds,
  serveFile,
  serveSummary,
} = require('../controllers/milestoneEvidence.controller');

const { protect, authorize }                        = require('../middleware/auth');
const { uploadEvidence: multerUpload, wrapMulterError } = require('../middleware/upload');

// ── Router A: campaign-context evidence routes ─────────────────────────────────
// Use mergeParams: true so :campaignId and :milestoneIndex flow through.

const campaignEvidenceRouter = express.Router({ mergeParams: true });

// List all bundles for this milestone
campaignEvidenceRouter.get('/', protect, listBundles);

// Latest bundle with full on-chain status
campaignEvidenceRouter.get('/latest', protect, getLatestBundle);

// Upload files — startup or admin may upload; multer validates MIME/size
campaignEvidenceRouter.post(
  '/upload',
  protect,
  authorize('startup', 'admin'),
  multerUpload,
  wrapMulterError,
  uploadEvidence
);

// Admin: manual re-anchor (recovery trigger)
campaignEvidenceRouter.post(
  '/anchor',
  protect,
  authorize('admin'),
  triggerAnchor
);

// Admin: approve evidence on-chain
campaignEvidenceRouter.post(
  '/approve',
  protect,
  authorize('admin'),
  approveEvidence
);

// Admin: reject evidence on-chain (body: { reason: "..." })
campaignEvidenceRouter.post(
  '/reject',
  protect,
  authorize('admin'),
  rejectEvidence
);

// Admin: release milestone funds on-chain
campaignEvidenceRouter.post(
  '/release',
  protect,
  authorize('admin'),
  releaseMilestoneFunds
);

// ── Router B: global file-serving ─────────────────────────────────────────────
// Mounted at /api/v1/evidence by routes/index.js.
// '/summary' MUST come before '/:fileIndex' to avoid Express matching "summary" as a number.

const evidenceFileRouter = express.Router();

evidenceFileRouter.get('/files/:bundleId/summary', protect, serveSummary);
evidenceFileRouter.get('/files/:bundleId/:fileIndex', protect, serveFile);

module.exports = {
  campaignEvidenceRouter,
  evidenceFileRouter,
};
