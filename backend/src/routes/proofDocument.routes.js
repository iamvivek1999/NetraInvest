/**
 * src/routes/proofDocument.routes.js
 *
 * Proof Document routes — mounted under /api/v1/milestones.
 *
 * Route map (all prefixed by /api/v1/milestones/:milestoneId):
 *   GET  /proof-summary               → lightweight summary (no fileUrl) — any authenticated user
 *   GET  /proof-documents             → full docs w/ premium gating       — any authenticated user
 *   POST /proof-documents             → add a document                    — startup only
 *   PATCH /proof-documents/:docId/summary → update AI summary            — admin only
 */

const express = require('express');

// mergeParams: true if mounted under another param router (milestone routes under campaigns)
const router = express.Router({ mergeParams: true });

const {
  getProofSummary,
  getProofDocuments,
  addProofDocument,
  updateSummary,
} = require('../controllers/proofDocument.controller');

const { protect, authorize } = require('../middleware/auth');

// ── Summary (lightweight, no fileUrl) ─────────────────────────────────────────
router.get('/:milestoneId/proof-summary', protect, getProofSummary);

// ── Full Documents (with premium gating on fileUrl) ───────────────────────────
router.get('/:milestoneId/proof-documents', protect, getProofDocuments);

// ── Add Document (startup, own campaign) ─────────────────────────────────────
router.post(
  '/:milestoneId/proof-documents',
  protect,
  authorize('startup', 'admin'),
  addProofDocument
);

// ── AI Agent: update summary ──────────────────────────────────────────────────
router.patch(
  '/:milestoneId/proof-documents/:documentId/summary',
  protect,
  authorize('admin'),
  updateSummary
);

module.exports = router;
