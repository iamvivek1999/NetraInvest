/**
 * src/models/EvidenceBundle.js
 *
 * EvidenceBundle — the single record of a milestone's uploaded proof package.
 *
 * One EvidenceBundle per (campaign × milestone).
 * A new document is created (or upserted) each time the startup submits or
 * resubmits evidence. The previous bundle is superseded but NOT deleted —
 * its files remain on disk for the audit trail.
 *
 * On-chain integration:
 *   evidenceHash and summaryHash are the two values passed to:
 *     contract.submitMilestoneEvidenceHash(campaignKey, milestoneIndex, evidenceHash, summaryHash)
 *
 * Local → IPFS/S3 migration:
 *   - storageBackend field tells readers which backend holds the files
 *   - relativePaths become CIDs or S3 keys when storageBackend changes
 *   - All hash fields remain identical — hashing is content-based, not path-based
 */

'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

// ─── File Sub-Schema ──────────────────────────────────────────────────────────

const evidenceFileSchema = new Schema(
  {
    /** Original filename as uploaded by the user */
    originalName: {
      type:      String,
      required:  true,
      trim:      true,
      maxlength: 260,
    },

    /** Sanitised filename as written to disk / storage */
    savedName: {
      type:  String,
      trim:  true,
    },

    /**
     * Path relative to STORAGE_ROOT — the ONLY path stored in MongoDB.
     * Example: "milestones/abc123/0/files/0_report.pdf"
     * When on IPFS: "ipfs://bafyreib..." (still treated as a path token)
     */
    relativePath: {
      type:     String,
      required: true,
      trim:     true,
    },

    mimeType: {
      type:      String,
      required:  true,
      trim:      true,
      lowercase: true,
    },

    category: {
      type:    String,
      enum:    ['pdf', 'image', 'csv', 'spreadsheet', 'doc', 'json', 'text', 'other'],
      default: 'other',
    },

    sizeBytes: {
      type: Number,
      min:  0,
    },

    /**
     * SHA-256 of the raw file buffer (hex, no 0x prefix).
     * Computed locally before any I/O so it can be independently verified.
     */
    fileHash: {
      type:    String,
      required: true,
      trim:    true,
      match:   [/^[a-f0-9]{64}$/, 'fileHash must be a 64-char hex SHA-256'],
    },

    uploadedAt: {
      type:    Date,
      default: Date.now,
    },
  },
  { _id: false }
);

// ─── Main Schema ──────────────────────────────────────────────────────────────

const evidenceBundleSchema = new Schema(
  {
    // ── Ownership ──────────────────────────────────────────────────────────────

    campaignId: {
      type:     Schema.Types.ObjectId,
      ref:      'Campaign',
      required: [true, 'Campaign reference is required'],
      // No inline index: true — covered by explicit compound index below
    },

    milestoneId: {
      type:  Schema.Types.ObjectId,
      ref:   'Milestone',
    },

    uploadedBy: {
      type:     Schema.Types.ObjectId,
      ref:      'User',
      required: [true, 'Uploader reference is required'],
    },

    // ── Context ───────────────────────────────────────────────────────────────

    /**
     * bytes32 key from the smart contract — links this record to the on-chain campaign.
     * Indexed for fast lookup when building evidence hash for contract submission.
     */
    campaignKey: {
      type:     String,
      required: [true, 'On-chain campaign key is required'],
      trim:     true,
      index:    true,
    },

    /**
     * 0-based index matching contract.milestoneIndex.
     * Compound unique index [campaignKey, milestoneIndex] is defined below.
     */
    milestoneIndex: {
      type:     Number,
      required: [true, 'Milestone index is required'],
      min:      [0, 'Milestone index must be 0 or greater'],
    },

    // ── Submission metadata ───────────────────────────────────────────────────

    title: {
      type:      String,
      trim:      true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
      default:   null,
    },

    description: {
      type:      String,
      trim:      true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
      default:   null,
    },

    // ── Files ─────────────────────────────────────────────────────────────────

    /** Array of uploaded file records — one per file in the bundle */
    evidenceFiles: {
      type:     [evidenceFileSchema],
      default:  [],
      validate: {
        validator: (arr) => arr.length <= 10,
        message:  'Cannot upload more than 10 files per bundle',
      },
    },

    // ── Extracted Data ────────────────────────────────────────────────────────
    // Large processed JSON is preserved purely through file storage; see extractedPath property 
    // ensuring we avoid bloating MongoDB responses.

    // ── Storage Paths (relative only) ─────────────────────────────────────────

    /** Relative path to extracted.json in the bundle directory */
    extractedPath: {
      type:  String,
      trim:  true,
      default: null,
    },

    /** Relative path to summary.json in the bundle directory */
    summaryPath: {
      type:  String,
      trim:  true,
      default: null,
    },

    /** Relative path to metadata.json in the bundle directory */
    metadataPath: {
      type:  String,
      trim:  true,
      default: null,
    },

    // ── Hashes (on-chain anchors) ─────────────────────────────────────────────

    /**
     * keccak256 of sorted, concatenated fileHashes.
     * This is the evidenceHash submitted to contract.submitMilestoneEvidenceHash().
     * 0x-prefixed 66-char hex string.
     */
    evidenceHash: {
      type:  String,
      trim:  true,
      match: [/^0x[a-fA-F0-9]{64}$/, 'evidenceHash must be a 0x-prefixed keccak256'],
      default: null,
    },

    /**
     * keccak256 of stably serialised summaryJson.
     * Submitted alongside evidenceHash to the contract.
     * 0x-prefixed 66-char hex string.
     */
    summaryHash: {
      type:  String,
      trim:  true,
      match: [/^0x[a-fA-F0-9]{64}$/, 'summaryHash must be a 0x-prefixed keccak256'],
      default: null,
    },

    // ── On-Chain Status ───────────────────────────────────────────────────────

    /**
     * Status of the on-chain submission.  Full lifecycle:
     *
     *   processed     → hashes computed, ready to anchor
     *   anchoring     → anchor tx sent, waiting for confirmation (transient)
     *   anchor_failed → anchor tx failed or process died; retry job will re-attempt
     *   anchored      → MilestoneEvidenceSubmitted event confirmed on-chain
     *   approved      → MilestoneEvidenceApproved event confirmed on-chain
     *   rejected      → MilestoneEvidenceRejected event confirmed; startup may resubmit
     *   released      → MilestoneReleased event confirmed; funds sent to startup
     */
    onChainStatus: {
      type:    String,
      enum:    ['processed', 'anchoring', 'anchor_failed', 'anchored', 'approved', 'rejected', 'releasing', 'released'],
      default: 'processed',
    },

    /** Tx hash from submitMilestoneEvidenceHash() */
    submitTxHash: {
      type:    String,
      trim:    true,
      match:   [/^0x[a-fA-F0-9]{64}$/, 'submitTxHash must be a valid tx hash'],
      default: null,
    },

    /** Block timestamp when the anchor tx was confirmed */
    anchoredAt: {
      type:    Date,
      default: null,
    },

    /**
     * Last anchor error message — cleared on success.
     * Surfaced in admin dashboards so ops can diagnose stuck bundles.
     */
    anchorError: {
      type:    String,
      trim:    true,
      default: null,
    },

    /** Tx hash from approveMilestoneEvidence() */
    approveTxHash: {
      type:    String,
      trim:    true,
      match:   [/^0x[a-fA-F0-9]{64}$/, 'approveTxHash must be a valid tx hash'],
      default: null,
    },

    approvedAt: { type: Date, default: null },

    /** Tx hash from rejectMilestoneEvidence() */
    rejectTxHash: {
      type:    String,
      trim:    true,
      match:   [/^0x[a-fA-F0-9]{64}$/, 'rejectTxHash must be a valid tx hash'],
      default: null,
    },

    rejectedAt:      { type: Date,   default: null },
    rejectionReason: { type: String, trim: true, default: null },

    /** Tx hash from releaseMilestone() */
    releaseTxHash: {
      type:    String,
      trim:    true,
      match:   [/^0x[a-fA-F0-9]{64}$/, 'releaseTxHash must be a valid tx hash'],
      default: null,
    },

    releasedAt: { type: Date, default: null },

    // ── Storage Backend ───────────────────────────────────────────────────────

    /**
     * Which storage system holds the files.
     * local → files in STORAGE_ROOT (this phase)
     * ipfs  → files on IPFS (future)
     * s3    → files in S3/GCS (future)
     */
    storageBackend: {
      type:    String,
      enum:    ['local', 'ipfs', 's3'],
      default: 'local',
    },

    // ── Timestamps ────────────────────────────────────────────────────────────

    uploadedAt: {
      type:    Date,
      default: Date.now,
    },

    processedAt: {
      type:    Date,
      default: null,
    },
  },
  {
    timestamps: true,  // createdAt + updatedAt
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

// Primary lookup: bundle for a specific milestone of a campaign
evidenceBundleSchema.index({ campaignKey: 1, milestoneIndex: 1 });

// Latest bundle per milestone (sort by createdAt desc to get most recent)
evidenceBundleSchema.index({ campaignKey: 1, milestoneIndex: 1, createdAt: -1 });

// Admin queue: all bundles awaiting on-chain submission
evidenceBundleSchema.index({ onChainStatus: 1, createdAt: -1 });

// Uploader queries
evidenceBundleSchema.index({ uploadedBy: 1, createdAt: -1 });

// Campaign-level queries
evidenceBundleSchema.index({ campaignId: 1 });

const EvidenceBundle = mongoose.model('EvidenceBundle', evidenceBundleSchema);

module.exports = EvidenceBundle;
