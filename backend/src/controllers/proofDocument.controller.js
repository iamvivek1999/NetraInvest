/**
 * src/controllers/proofDocument.controller.js
 *
 * Proof Document endpoints.
 *
 * ─── Access Tiers ────────────────────────────────────────────────────────────
 *
 *   GET /api/v1/milestones/:milestoneId/proof-summary
 *     → Public summary: fileName, fileType, order, premiumRequired flag, and
 *       AI-generated summary (if available). Does NOT expose fileUrl.
 *     → Available to any authenticated user (investor or startup).
 *
 *   GET /api/v1/milestones/:milestoneId/proof-documents
 *     → Full document data including fileUrl.
 *     → Documents with premiumRequired=false → fileUrl exposed to all authenticated users.
 *     → Documents with premiumRequired=true  → fileUrl is redacted ("PREMIUM_REQUIRED")
 *       unless the requesting user is a premium investor.
 *     → Admins always see all fileUrls.
 *
 * ─── Premium Logic ────────────────────────────────────────────────────────────
 *
 *   isPremium = true when:
 *     - req.user.role === 'admin'
 *     - OR  req.user.role === 'investor' AND their InvestorProfile.premiumStatus === true
 *
 *   Redaction: fileUrl replaced with the string "PREMIUM_REQUIRED" for gated docs.
 *   A `locked: true` boolean is added to the document object for UI gating.
 */

const Milestone     = require('../models/Milestone');
const ProofDocument = require('../models/ProofDocument');
const InvestorProfile = require('../models/InvestorProfile');
const sendResponse  = require('../utils/sendResponse');
const { ApiError }  = require('../middleware/errorHandler');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Load the milestone by ID and verify the campaign matches the URL param (if provided).
 */
const loadMilestone = async (milestoneId) => {
  const milestone = await Milestone.findById(milestoneId).select(
    'campaignId status title index'
  );
  if (!milestone) throw new ApiError('Milestone not found.', 404);
  return milestone;
};

/**
 * Determine if the requesting user has premium access.
 * Admins always have premium access.
 * Investors: check their InvestorProfile.premiumStatus.
 */
const resolvePremiumAccess = async (user) => {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'investor') {
    const profile = await InvestorProfile.findOne({ userId: user.userId }).select('premiumStatus');
    return !!(profile?.premiumStatus);
  }
  // Startups and others do not get premium access to investor-gated documents
  return false;
};

/**
 * Redact fileUrl for non-premium users on premium-required documents.
 * Attaches `locked: true` so the frontend can show a lock icon / upgrade CTA.
 */
const applyPremiumGate = (doc, isPremium) => {
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  if (obj.premiumRequired && !isPremium) {
    obj.fileUrl = null;
    obj.locked  = true;
  } else {
    obj.locked = false;
  }
  return obj;
};

// ─── GET Proof Summary ────────────────────────────────────────────────────────

/**
 * GET /api/v1/milestones/:milestoneId/proof-summary
 *
 * Returns lightweight card data: no fileUrl.
 * Suitable for investor feed cards, campaign detail pages.
 *
 * Shape per document:
 *   { _id, fileName, fileType, order, premiumRequired, summary, summaryGeneratedAt, createdAt }
 */
const getProofSummary = async (req, res) => {
  const { milestoneId } = req.params;

  await loadMilestone(milestoneId);

  const docs = await ProofDocument.find({ milestoneId })
    .sort({ order: 1, createdAt: 1 })
    .select(
      '_id fileName fileType order premiumRequired summary summaryGeneratedAt createdAt'
    );

  sendResponse(res, 200, 'Proof summary retrieved', {
    count:     docs.length,
    documents: docs,
  });
};

// ─── GET Proof Documents (Full) ───────────────────────────────────────────────

/**
 * GET /api/v1/milestones/:milestoneId/proof-documents
 *
 * Returns all proof documents with fileUrl subject to premium gating.
 *
 * Shape per document:
 *   { _id, fileName, fileType, fileUrl|null, fileSizeBytes, order,
 *     premiumRequired, locked, summary, summaryGeneratedAt, createdAt }
 *
 * `locked: true` + `fileUrl: null` → frontend renders lock icon + upgrade CTA.
 * `locked: false`                  → fileUrl is usable.
 */
const getProofDocuments = async (req, res) => {
  const { milestoneId } = req.params;

  await loadMilestone(milestoneId);

  const isPremium = await resolvePremiumAccess(req.user);

  const rawDocs = await ProofDocument.find({ milestoneId })
    .sort({ order: 1, createdAt: 1 })
    .select(
      '_id fileName fileType fileUrl fileSizeBytes order premiumRequired summary summaryGeneratedAt createdAt'
    );

  const documents = rawDocs.map((doc) => applyPremiumGate(doc, isPremium));

  const lockedCount  = documents.filter((d) => d.locked).length;
  const visibleCount = documents.length - lockedCount;

  sendResponse(res, 200, 'Proof documents retrieved', {
    count:        documents.length,
    visibleCount,
    lockedCount,
    isPremium,
    documents,
  });
};

// ─── Upload Proof Document ────────────────────────────────────────────────────

/**
 * POST /api/v1/milestones/:milestoneId/proof-documents
 * Role: startup only (own campaign)
 *
 * Body:
 *   { fileName, fileType, fileUrl, fileSizeBytes?, premiumRequired?, order? }
 *
 * In Phase 2 this will integrate with Cloudinary/S3 pre-signed URL upload.
 * For now the client sends the fileUrl directly (stub / admin-created docs).
 */
const addProofDocument = async (req, res) => {
  const { milestoneId } = req.params;
  const { userId }      = req.user;

  const milestone = await loadMilestone(milestoneId);

  // Verify current user owns the campaign this milestone belongs to
  const Campaign = require('../models/Campaign');
  const campaign = await Campaign.findById(milestone.campaignId).select('userId');
  if (!campaign) throw new ApiError('Campaign not found.', 404);
  if (campaign.userId.toString() !== userId) {
    throw new ApiError('You are not authorized to upload documents for this milestone.', 403);
  }

  const {
    fileName,
    fileType,
    fileUrl,
    fileSizeBytes,
    premiumRequired = false,
    order,
  } = req.body;

  if (!fileName || !fileType || !fileUrl) {
    throw new ApiError('fileName, fileType, and fileUrl are required.', 400);
  }

  // Auto-assign order if not provided
  const resolvedOrder = order != null
    ? order
    : await ProofDocument.countDocuments({ milestoneId });

  const doc = await ProofDocument.create({
    milestoneId,
    campaignId:  milestone.campaignId,
    uploadedBy:  userId,
    fileName,
    fileType,
    fileUrl,
    fileSizeBytes: fileSizeBytes ?? null,
    premiumRequired,
    order: resolvedOrder,
  });

  sendResponse(res, 201, 'Proof document added successfully.', { document: doc });
};

// ─── Update AI Summary ─────────────────────────────────────────────────────────

/**
 * PATCH /api/v1/milestones/:milestoneId/proof-documents/:documentId/summary
 * Role: admin only (called by AI agent pipeline)
 *
 * Populates the AI-generated summary field.
 * This is the endpoint the AI agent calls after processing the document.
 */
const updateSummary = async (req, res) => {
  const { milestoneId, documentId } = req.params;
  const { summary } = req.body;

  if (!summary || typeof summary !== 'string') {
    throw new ApiError('summary string is required.', 400);
  }

  const doc = await ProofDocument.findOneAndUpdate(
    { _id: documentId, milestoneId },
    {
      $set: {
        summary,
        summaryGeneratedAt: new Date(),
      },
    },
    { new: true, runValidators: true }
  );

  if (!doc) throw new ApiError('Proof document not found.', 404);

  sendResponse(res, 200, 'AI summary updated.', { document: doc });
};

module.exports = {
  getProofSummary,
  getProofDocuments,
  addProofDocument,
  updateSummary,
};
