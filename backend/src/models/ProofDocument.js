/**
 * src/models/ProofDocument.js
 *
 * ProofDocument — a single uploaded file attached to a milestone proof submission.
 *
 * Design:
 *   - Each ProofDocument belongs to ONE milestone (milestoneId).
 *   - Multiple ProofDocuments can exist per milestone (1 per uploaded file).
 *   - `summary` is an AI-generated description — populated externally by an AI agent
 *     after upload. Stored here for retrieval. Null until agent runs.
 *   - `premiumRequired` gates the full document access.
 *       false → any authenticated user can view fileName + summary
 *       true  → only investors with premiumStatus=true can view full document URL
 *
 * Access tiers:
 *   GET /api/v1/milestones/:id/proof-summary
 *     → returns fileName, fileType, summary for ALL documents
 *     → available to any authenticated user
 *
 *   GET /api/v1/milestones/:id/proof-documents
 *     → returns full data including fileUrl
 *     → for premiumRequired=true docs, fileUrl is redacted unless req.user is premium investor
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

const proofDocumentSchema = new Schema(
  {
    // ── Ownership ──────────────────────────────────────────────────────────────
    milestoneId: {
      type: Schema.Types.ObjectId,
      ref: 'Milestone',
      required: [true, 'Milestone reference is required'],
      index: true,
    },

    campaignId: {
      type: Schema.Types.ObjectId,
      ref: 'Campaign',
      required: [true, 'Campaign reference is required'],
      index: true,
    },

    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Uploader reference is required'],
    },

    // ── File Metadata ─────────────────────────────────────────────────────────
    fileName: {
      type: String,
      required: [true, 'File name is required'],
      trim: true,
      maxlength: [260, 'File name cannot exceed 260 characters'],
    },

    fileType: {
      type: String,
      required: [true, 'File type is required'],
      trim: true,
      lowercase: true,
      enum: {
        values: [
          'pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp',
          'mp4', 'mov', 'avi',
          'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
          'txt', 'csv', 'json', 'zip', 'other',
        ],
        message: 'Unsupported file type: {VALUE}',
      },
    },

    // Stored URL: cloud storage path (S3, GCS, Cloudinary, etc.)
    // or an IPFS CID for decentralised storage.
    // Redacted in API response for premiumRequired=true docs unless user is premium.
    fileUrl: {
      type: String,
      required: [true, 'File URL is required'],
      trim: true,
    },

    fileSizeBytes: {
      type: Number,
      default: null,
      min: [0, 'File size cannot be negative'],
    },

    // ── AI-Generated Summary ───────────────────────────────────────────────────
    /**
     * Populated by an external AI agent after the document is uploaded.
     * Null until the agent processes the file.
     * Shown to ALL authenticated users in the proof-summary endpoint.
     */
    summary: {
      type: String,
      trim: true,
      maxlength: [1000, 'AI summary cannot exceed 1000 characters'],
      default: null,
    },

    summaryGeneratedAt: {
      type: Date,
      default: null,
    },

    // ── Access Control ────────────────────────────────────────────────────────
    /**
     * false (default) → fileName, fileType, summary, AND fileUrl are public to
     *                   all authenticated users.
     * true            → fileName, fileType, summary visible to all authenticated
     *                   users; fileUrl ONLY to premium investors.
     */
    premiumRequired: {
      type: Boolean,
      default: false,
    },

    // ── Ordering ─────────────────────────────────────────────────────────────
    // Upload order within the milestone (0-based, assigned by controller)
    order: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

// Primary query: all docs for a milestone
proofDocumentSchema.index({ milestoneId: 1, order: 1 });

// Campaign-level queries (admin view all docs for a campaign)
proofDocumentSchema.index({ campaignId: 1 });

// Premium gate queries
proofDocumentSchema.index({ milestoneId: 1, premiumRequired: 1 });

const ProofDocument = mongoose.model('ProofDocument', proofDocumentSchema);

module.exports = ProofDocument;
