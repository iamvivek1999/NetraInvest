/**
 * src/models/Milestone.js
 *
 * Milestone — one stage in a campaign's fund release plan.
 * Each campaign has exactly milestoneCount milestones (1–5).
 *
 * Design decisions:
 *
 * 1. index (0-based) matches the on-chain milestoneIndex used in
 *    contract.releaseMilestone(campaignKey, milestoneIndex).
 *    Compound unique index [campaignId, index] enforces correct ordering.
 *
 * 2. percentage is copied from campaign.milestonePercentages[index] at
 *    creation time and stored here for auditability. If the campaign
 *    percentages are ever viewed in isolation (per-milestone), the data is
 *    self-contained and does not require joining back to the campaign.
 *
 * 3. estimatedAmount is a snapshot: campaign.fundingGoal × percentage / 100
 *    Stored at creation time. If fundingGoal changes before activation, this
 *    becomes stale — but fundingGoal is locked once active, so it's safe.
 *
 * 4. proofSubmission is an embedded subdoc (not a separate collection).
 *    Proof is immutable once submitted — only the status changes.
 *
 * 5. On-chain release tracking: releasedAmountWei, releaseTxHash, releasedAt.
 *    These are null until admin calls releaseMilestone() on-chain (Phase 2).
 *    The contract emits MilestoneReleased(campaignKey, index, amount) which the
 *    backend decodes and stores here. These are the authoritative release records.
 *    The legacy off-chain disbursal fields (disbursedAmount, disbursalReference)
 *    are kept for historical compatibility but should not be used for new releases.
 *
 * Status lifecycle:
 *   reviewStatus: pending → submitted → under_review → approved/rejected
 *   onChainStatus: unreleased → released
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

// ─── Proof Submission Sub-schema ──────────────────────────────────────────────

const proofSubmissionSchema = new Schema(
  {
    description: {
      type: String,
      required: [true, 'Proof description is required'],
      trim: true,
      minlength: [20, 'Proof description must be at least 20 characters'],
      maxlength: [2000, 'Proof description cannot exceed 2000 characters'],
    },

    // URLs to public evidence: GitHub repo, demo video, deployed app, etc.
    proofLinks: {
      type: [String],
      default: [],
      validate: {
        validator: (arr) => arr.length <= 10,
        message: 'Cannot provide more than 10 proof links',
      },
    },

    // Document URLs / IPFS CIDs (pitch updates, screenshots, certificates)
    documents: {
      type: [
        {
          label:            { type: String, trim: true, maxlength: 100 },
          url:              { type: String, required: true, trim: true },
          fileName:         { type: String, trim: true },
          fileType:         { type: String, trim: true },
          fileSize:         { type: Number },
          mimeType:         { type: String, trim: true },
          storagePath:      { type: String, trim: true },
          archivePath:      { type: String, trim: true },
          documentCategory: { type: String, trim: true },
          uploadedAt:       { type: Date, default: Date.now }
        },
      ],
      default: [],
      validate: {
        validator: (arr) => arr.length <= 15, // Expanded threshold to cover more upload types
        message: 'Cannot upload more than 15 supporting documents',
      },
    },

    submittedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false } // no separate _id for embedded subdoc
);

// ─── Main Schema ──────────────────────────────────────────────────────────────

const milestoneSchema = new Schema(
  {
    // ── Ownership / Context ──────────────────────────────────────────────────
    campaignId: {
      type: Schema.Types.ObjectId,
      ref: 'Campaign',
      required: [true, 'Campaign reference is required'],
    },

    // Denormalized for fast ownership checks (avoids join through Campaign)
    startupProfileId: {
      type: Schema.Types.ObjectId,
      ref: 'StartupProfile',
      required: true,
    },

    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // ── Ordering ─────────────────────────────────────────────────────────────
    /**
     * 0-based index. Matches on-chain milestoneIndex.
     * Unique per campaign — enforced by compound index below.
     * Milestones must be processed sequentially (index 0 → 1 → 2).
     */
    milestoneIndex: {
      type: Number,
      required: [true, 'Milestone index is required'],
      min: [0, 'Index must be 0 or greater'],
    },

    // ── Content ──────────────────────────────────────────────────────────────
    title: {
      type: String,
      required: [true, 'Milestone title is required'],
      trim: true,
      maxlength: [120, 'Title cannot exceed 120 characters'],
    },

    description: {
      type: String,
      required: [true, 'Milestone description is required'],
      trim: true,
      minlength: [20, 'Description must be at least 20 characters'],
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },

    targetDate: {
      type: Date,
      default: null,
      // Optional estimated completion date for this milestone
    },

    // ── Funding Configuration (snapshot at creation) ──────────────────────────
    /**
     * percentage is copied from campaign.milestonePercentages[this.index].
     * Stored here for auditability — no join back to campaign needed for audits.
     */
    percentage: {
      type: Number,
      required: [true, 'Milestone percentage is required'],
      min: [0.01, 'Percentage must be greater than 0'],
      max: [100, 'Percentage cannot exceed 100'],
    },

    /**
     * targetAmount = campaign.fundingGoal × percentage / 100
     * Snapshot at creation time. Read-only after creation.
     * This is in the same denomination as campaign.fundingGoal (INR display).
     * For on-chain amounts, use targetAmountWei and releasedAmountWei after release.
     * Actual released amount may differ if fundingGoal is not fully reached.
     */
    targetAmount: {
      type: Number,
      required: true,
      min: [0, 'Target amount cannot be negative'],
    },

    /**
     * targetAmountWei: EXACT mapped wei derived from fundingGoalWei * percentage.
     */
    targetAmountWei: {
      type: String,
      default: null,
    },

    // Tracks current progress incrementally prior to submission
    progressPercent: {
      type: Number,
      default: 0,
      min: [0, 'Progress cannot be negative'],
      max: [100, 'Progress cannot exceed 100'],
    },

    // ── Status ───────────────────────────────────────────────────────────────
    /**
     * reviewStatus values (Administrative off-chain state):
     *
     *   pending       → Initial state. Startup has not yet submitted proof.
     *   submitted     → Startup submitted proof. Awaiting admin review.
     *   under_review  → Admin is actively reviewing.
     *   approved      → Admin approved. Ready for on-chain fund release.
     *   rejected      → Admin rejected submission. Startup must resubmit.
     */
    reviewStatus: {
      type: String,
      enum: {
        values: ['pending', 'submitted', 'under_review', 'approved', 'rejected'],
        message: 'Invalid milestone review status',
      },
      default: 'pending',
    },

    /**
     * onChainStatus values:
     * 
     *   unreleased → Funds are locked in the smart contract.
     *   released   → Funds have been successfully transferred to Startup wallet.
     */
    onChainStatus: {
      type: String,
      enum: {
        values: ['unreleased', 'released'],
        message: 'Invalid milestone on-chain status',
      },
      default: 'unreleased',
    },

    /**
     * Array of references to EvidenceBundle IDs for historical tracking.
     */
    evidenceBundles: [{
      type: Schema.Types.ObjectId,
      ref: 'EvidenceBundle',
    }],

    // ── Extracted Artifact Anchors (Denormalized from Evidence Bundle) ─────────
    localStoragePaths: {
      type: [String],
      default: [],
    },

    summaryHash: {
      type: String,
      default: null,
    },

    evidenceHash: {
      type: String,
      default: null,
    },

    evidenceAnchorTxHash: {
      type: String,
      default: null,
    },

    // ── Admin Approval ───────────────────────────────────────────────────────
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    approvedAt: {
      type: Date,
      default: null,
    },

    rejectionReason: {
      type: String,
      trim: true,
      maxlength: [500, 'Rejection reason cannot exceed 500 characters'],
      default: null,
    },

    rejectedAt: {
      type: Date,
      default: null,
    },

    // ── Off-Chain Disbursal Tracking ──────────────────────────────────────────
    // UPDATED FOR OFF-CHAIN MILESTONE DISBURSAL

    disbursedAmount: {
      type: Number,
      default: null,
      min: [0, 'Disbursed amount cannot be negative'],
    },

    disbursedAt: {
      type: Date,
      default: null,
    },

    disbursedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    disbursalReference: {
      type: String,
      trim: true,
      default: null,
    },

    disbursalNote: {
      type: String,
      trim: true,
      default: null,
    },

    // ── On-Chain Release Tracking (authoritative for Web3 path) ─────────────────
    /**
     * releasedAmountWei: exact wei released for this milestone from the contract.
     * Decoded from MilestoneReleased event. Stored as String for uint256 safety.
     * Null until admin triggers releaseMilestone() on-chain.
     */
    releasedAmountWei: {
      type: String,
      default: null,
    },

    /**
     * releaseTxHash: the on-chain tx hash from admin's releaseMilestone() call.
     * Used for audit trails and explorer links.
     */
    releaseTxHash: {
      type: String,
      default: null,
      match: [
        /^0x[a-fA-F0-9]{64}$/,
        'releaseTxHash must be a valid Ethereum transaction hash',
      ],
    },

    /**
     * releasedAt: block timestamp of the MilestoneReleased event.
     * Set by the backend after decoding the on-chain event.
     */
    releasedAt: {
      type: Date,
      default: null,
    },
    
    /**
     * releasedAtBlock: the block number of the MilestoneReleased event
     */
    releasedAtBlock: {
      type: Number,
      default: null,
    },

    // ── Sync Metadata ────────────────────────────────────────────────────────
    syncStatus: {
      type: String,
      enum: ['pending', 'confirmed', 'failed', 'resync_required'],
      default: 'pending',
    },

    lastSyncedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

// Primary compound: enforces unique index per campaign, enables ordered queries
milestoneSchema.index({ campaignId: 1, milestoneIndex: 1 }, { unique: true });

// Status-based queries (admin review queue)
milestoneSchema.index({ reviewStatus: 1 });
milestoneSchema.index({ onChainStatus: 1 });

// Startup's own milestone view
milestoneSchema.index({ userId: 1 });
milestoneSchema.index({ startupProfileId: 1 });

// Admin approval queue: all submitted milestones across all campaigns
milestoneSchema.index({ reviewStatus: 1, createdAt: -1 });

// Phase 2: find milestones pending release
milestoneSchema.index({ campaignId: 1, reviewStatus: 1, onChainStatus: 1 });

const Milestone = mongoose.model('Milestone', milestoneSchema);

module.exports = Milestone;
