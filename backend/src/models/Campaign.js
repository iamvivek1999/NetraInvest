/**
 * src/models/Campaign.js
 *
 * Campaign — a startup's funding request linked to its StartupProfile.
 *
 * Key design decisions:
 *
 * 1. startupProfileId (not just userId) is the primary ownership reference.
 *    This creates a clear domain boundary: User → StartupProfile → Campaign.
 *
 * 2. userId is denormalized on the campaign for fast ownership checks
 *    without a join through StartupProfile on every request.
 *
 * 3. campaignKey and contractAddress are nullable at creation.
 *    They are populated when the smart contract is deployed (Phase 2).
 *    The schema is designed so blockchain integration requires zero model changes.
 *
 * 4. milestonePercentages must sum to 100 and must have exactly
 *    milestoneCount elements. This mirrors what the smart contract will enforce.
 *
 * 5. currentRaised and currentReleased are tracked in MongoDB for fast reads.
 *    The smart contract is the financial source of truth — MongoDB is the
 *    read-optimized cache (reconcilable via txHash references on investments).
 *
 * Status lifecycle:
 *   draft → active → funded → completed
 *              ↓
 *           paused → active
 *              ↓
 *           cancelled
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

const campaignSchema = new Schema(
  {
    // ── Ownership ────────────────────────────────────────────────────────────
    startupProfileId: {
      type: Schema.Types.ObjectId,
      ref: 'StartupProfile',
      required: [true, 'Startup profile reference is required'],
    },

    // Denormalized for ownership checks without a join on every protected request
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
    },

    // ── Core Fields ──────────────────────────────────────────────────────────
    title: {
      type: String,
      required: [true, 'Campaign title is required'],
      trim: true,
      maxlength: [120, 'Title cannot exceed 120 characters'],
    },

    summary: {
      type: String,
      required: [true, 'Campaign summary is required'],
      trim: true,
      minlength: [30, 'Summary must be at least 30 characters'],
      maxlength: [500, 'Summary cannot exceed 500 characters'],
    },

    // ── Funding Configuration ────────────────────────────────────────────────
    fundingGoal: {
      type: Number,
      required: [true, 'Funding goal is required'],
      min: [1, 'Funding goal must be greater than 0'],
    },

    currency: {
      type: String,
      enum: {
        values: ['INR', 'ETH'],
        message: 'Currency must be INR or ETH',
      },
      default: 'INR',
    },

    minInvestment: {
      type: Number,
      default: 1,
      min: [0.001, 'Minimum investment must be greater than 0'],
    },

    maxInvestment: {
      type: Number,
      default: null,
      // Validated in pre-validate hook: must be > minInvestment if set
    },

    deadline: {
      type: Date,
      required: [true, 'Campaign deadline is required'],
    },

    // ── Status ───────────────────────────────────────────────────────────────
    /**
     * Status values for MVP:
     *
     *   draft      → Created but not yet published. Editable. Not visible to investors.
     *   active     → Live and accepting investments. Contract will be deployed here.
     *   paused     → Temporarily stopped by startup. No new investments accepted.
     *   funded     → fundingGoal has been reached. System-set.
     *   completed  → All milestones released and closed. System-set.
     *   cancelled  → Permanently cancelled. Refunds triggered.
     *
     * Only startup can set: draft → active, active → paused, paused → active,
     *                       active/paused → cancelled
     * System-set only:      → funded, → completed
     */
    status: {
      type: String,
      enum: {
        values: ['draft', 'active', 'paused', 'funded', 'completed', 'cancelled'],
        message: 'Invalid campaign status',
      },
      default: 'draft',
    },

    // ── Progress Tracking ────────────────────────────────────────────────────
    currentRaised: {
      type: Number,
      default: 0,
      min: [0, 'currentRaised cannot be negative'],
    },

    currentReleased: {
      type: Number,
      default: 0,
      min: [0, 'currentReleased cannot be negative'],
    },

    investorCount: {
      type: Number,
      default: 0,
      min: [0, 'investorCount cannot be negative'],
    },

    // ── Milestone Configuration ──────────────────────────────────────────────
    /**
     * milestoneCount and milestonePercentages define the fund release schedule.
     * These values are passed to the smart contract at deployment time.
     * Once the campaign goes ACTIVE (contract deployed), these MUST NOT change.
     *
     * Example:
     *   milestoneCount: 3
     *   milestonePercentages: [30, 40, 30]   → sums to 100
     *
     * Milestone index 0 = first milestone (first release), etc.
     */
    milestoneCount: {
      type: Number,
      required: [true, 'Number of milestones is required'],
      min: [1, 'Must have at least 1 milestone'],
      max: [5, 'Cannot have more than 5 milestones'],
    },

    milestonePercentages: {
      type: [Number],
      required: [true, 'Milestone percentages are required'],
      validate: [
        {
          validator(arr) {
            return arr.length === this.milestoneCount;
          },
          message: 'Number of milestone percentages must match milestoneCount',
        },
        {
          validator(arr) {
            const sum = arr.reduce((acc, v) => acc + v, 0);
            return Math.abs(sum - 100) < 0.001; // float tolerance
          },
          message: 'Milestone percentages must sum to exactly 100',
        },
        {
          validator(arr) {
            return arr.every((v) => v > 0);
          },
          message: 'Each milestone percentage must be greater than 0',
        },
      ],
    },

    currentMilestoneIndex: {
      type: Number,
      default: 0,
      // Incremented by the system after each milestone is released
    },

    // ── Blockchain Integration (populated after Phase 2 deployment) ──────────
    /**
     * campaignKey: bytes32 key used inside the transparency registry.
     * Generated by the backend as a random bytes32 before calling createCampaign().
     * Stored here as a hex string (0x + 64 hex chars).
     * Null until the campaign is activated and the contract call is made.
     */
    campaignKey: {
      type: String,
      default: null,
      match: [
        /^0x[a-fA-F0-9]{64}$/,
        'campaignKey must be a valid bytes32 hex string',
      ],
      // sparse unique: no two active campaigns share a key, nulls excluded
    },

    /**
     * contractAddress: the single InvestmentPlatform.sol contract address.
     * Same value for all campaigns — stored here for reference and verification.
     * Null until first campaign is activated (contract is global, deployed once).
     */
    contractAddress: {
      type: String,
      default: null,
      match: [
        /^0x[a-fA-F0-9]{40}$/,
        'contractAddress must be a valid Ethereum address',
      ],
    },

    /**
     * isContractDeployed: convenience flag.
     * True once campaignKey is written to the on-chain contract.
     * Allows quick filter: Campaign.find({ isContractDeployed: false, status: 'active' })
     */
    isContractDeployed: {
      type: Boolean,
      default: false,
    },

    /**
     * activationTxHash: the on-chain tx hash from the createCampaign() call.
     * Populated by activateCampaign controller after successful tx.wait().
     * Null for campaigns that were created before blockchain integration.
     */
    activationTxHash: {
      type: String,
      default: null,
    },

    // ── Discovery ────────────────────────────────────────────────────────────
    tags: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// ─── Pre-validate Hook: maxInvestment check ───────────────────────────────────

campaignSchema.pre('validate', function (next) {
  if (this.maxInvestment !== null && this.maxInvestment !== undefined) {
    if (this.maxInvestment <= this.minInvestment) {
      this.invalidate(
        'maxInvestment',
        'maxInvestment must be greater than minInvestment'
      );
    }
    if (this.maxInvestment > this.fundingGoal) {
      this.invalidate(
        'maxInvestment',
        'maxInvestment cannot exceed the funding goal'
      );
    }
  }
  next();
});

// ─── Indexes ──────────────────────────────────────────────────────────────────

campaignSchema.index({ startupProfileId: 1 });
campaignSchema.index({ userId: 1 });
campaignSchema.index({ status: 1 });
campaignSchema.index({ deadline: 1 });
campaignSchema.index({ currency: 1 });

// Compound: find active campaigns efficiently for discovery page
campaignSchema.index({ status: 1, createdAt: -1 });

// Compound: find all campaigns for a startup (dashboard query)
campaignSchema.index({ userId: 1, status: 1 });

// Sparse unique on campaignKey (nulls excluded)
campaignSchema.index({ campaignKey: 1 }, { unique: true, sparse: true });

// Text search on title and summary
campaignSchema.index(
  { title: 'text', summary: 'text' },
  { name: 'campaign_text_search' }
);

const Campaign = mongoose.model('Campaign', campaignSchema);

module.exports = Campaign;
