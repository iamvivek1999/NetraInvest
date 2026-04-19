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
 * 5. currentRaised / currentReleased track the display (INR) denomination in MongoDB
 *    for fast human-readable reads. They are the read-optimized cache.
 *    currentRaisedWei / currentReleasedWei are the authoritative on-chain amounts
 *    stored as strings to safely represent values beyond JS 53-bit integer limit.
 *    The smart contract is the financial source of truth — MongoDB is reconciled
 *    via txHash references on investments.
 *
 * 6. fundingGoalPOL is the on-chain funding goal in POL decimal (e.g. "2.5").
 *    It is passed to ethers.parseEther() when activating the campaign on-chain.
 *    fundingGoal (Number) is the INR display target shown to investors in the UI.
 *    These two fields serve completely separate purposes and must never be mixed.
 *
 * Status lifecycle:
 *   localStatus: draft → submitted → under_review → approved
 *              ↓
 *           rejected
 * 
 *   onChainStatus: unregistered → active → funded → completed
 *              ↓
 *           paused → active
 *              ↓
 *           cancelled
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

const useOfFundsSchema = new Schema(
  {
    category: { type: String, required: true },
    percentage: { type: Number, required: true, min: 0, max: 100 },
    amount: { type: Number, required: true },
  },
  { _id: false }
);

const campaignDocumentSchema = new Schema(
  {
    label: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const milestonePlanSchema = new Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    expectedStartDate: { type: Date, required: true },
    expectedEndDate: { type: Date, required: true },
    requiredBudget: { type: Number, required: true },
    expectedOutcome: { type: String, required: true },
    sequenceNumber: { type: Number, required: true },
  },
  { _id: true }
);

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

    detailedDescription: {
      type: String,
      trim: true,
      default: '',
    },

    // ── Discovery Fields ─────────────────────────────────────────────────────
    sector: {
      type: String,
      required: [true, 'Sector is required'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
    },
    fundingStage: {
      type: String,
      enum: ['pre-seed', 'seed', 'series-a', 'series-b', 'series-c', 'growth'],
      required: [true, 'Funding stage is required'],
    },
    riskScore: {
      type: Number,
      min: 1,
      max: 10,
      required: [true, 'Risk score is required'],
    },
    returnPotential: {
      type: String,
      enum: ['low', 'medium', 'high', 'moonshot'],
      required: [true, 'Return potential is required'],
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
        values: ['INR', 'ETH', 'POL'],
        message: 'Currency must be INR, ETH, or POL',
      },
      default: 'INR',
    },

    /**
     * fundingGoalPOL: the on-chain funding goal expressed as a POL decimal string.
     * (e.g. "2.5" for 2.5 POL → parsed via ethers.parseEther() on activation)
     * Required before a campaign can be activated. Never used for INR display.
     * Locked once campaign is activated (on-chain registration uses this value).
     */
    fundingGoalPOL: {
      type: String,
      default: null,
    },

    /**
     * fundingGoalWei: the exact wei representation of fundingGoalPOL.
     * Set by the activation controller after parseEther(fundingGoalPOL).
     * Stored as String to safely represent uint256 values.
     */
    fundingGoalWei: {
      type: String,
      default: null,
    },

    /**
     * minInvestmentWei / maxInvestmentWei: on-chain investment thresholds in wei.
     * Derived from minInvestment (POL decimal) at activation time.
     * Null until campaign is activated.
     */
    minInvestmentWei: {
      type: String,
      default: null,
    },

    maxInvestmentWei: {
      type: String,
      default: null,
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

    expectedTimelineMonths: {
      type: Number,
      min: [1, 'Timeline must be at least 1 month'],
      default: null,
    },

    // ── Status ───────────────────────────────────────────────────────────────
    /**
     * localStatus values (Administrative & Discovery prep):
     *
     *   draft          → Editable. Not visible.
     *   submitted      → Submitted by startup for admin review.
     *   under_review   → Admin currently reviewing.
     *   approved       → Admin approved. Ready to activate on-chain.
     *   rejected       → Rejected by admin.
     */
    localStatus: {
      type: String,
      enum: {
        values: [
          'draft',
          'submitted',
          'under_review',
          'approved',
          'rejected'
        ],
        message: 'Invalid campaign local status',
      },
      default: 'draft',
    },

    /**
     * onChainStatus values (Blockchain smart contract mapping):
     *
     *   unregistered   → Contract state not yet initialized.
     *   active         → Live and accepting investments. Contract deployed.
     *   paused         → Temporarily stopped by startup on-chain.
     *   funded         → fundingGoal reached. System-set.
     *   completed      → All milestones released and closed on-chain.
     *   cancelled      → Permanently cancelled on-chain.
     */
    onChainStatus: {
      type: String,
      enum: {
        values: [
          'unregistered',
          'active',
          'paused',
          'funded',
          'completed',
          'cancelled'
        ],
        message: 'Invalid campaign on-chain status',
      },
      default: 'unregistered',
    },

    // ── Progress Tracking ────────────────────────────────────────────────────
    /**
     * currentRaised: display-denomination total raised (INR or POL decimal).
     * Updated on each confirmed investment for fast UI display.
     * NOT the authoritative on-chain amount — use currentRaisedWei for contract logic.
     */
    currentRaised: {
      type: Number,
      default: 0,
      min: [0, 'currentRaised cannot be negative'],
    },

    /**
     * totalRaisedWei: authoritative on-chain total raised stored as string.
     * Accumulated from InvestmentReceived event amountWei values.
     * Stored as String to safely represent uint256 values beyond JS 53-bit limit.
     */
    totalRaisedWei: {
      type: String,
      default: '0',
    },

    /**
     * currentReleased: display-denomination total released (decimal).
     * NOT the authoritative on-chain amount — use currentReleasedWei for contract logic.
     */
    currentReleased: {
      type: Number,
      default: 0,
      min: [0, 'currentReleased cannot be negative'],
    },

    /**
     * currentReleasedWei: authoritative on-chain total released as string.
     * Updated by the admin releaseMilestone controller after on-chain confirmation.
     */
    currentReleasedWei: {
      type: String,
      default: '0',
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

    // ── Pre-launch Planning ──────────────────────────────────────────────────
    milestonePlans: {
      type: [milestonePlanSchema],
      default: [],
    },

    useOfFunds: {
      type: [useOfFundsSchema],
      default: [],
    },
    
    projectedRevenue: {
      type: Number,
      default: null,
      min: 0,
    },

    projectedProfit: {
      type: Number,
      default: null,
    },

    riskFactors: {
      type: String,
      trim: true,
      default: '',
    },

    campaignDocuments: {
      type: [campaignDocumentSchema],
      default: [],
    },

    adminReviewNotes: {
      type: String,
      trim: true,
      default: '',
    },

    // ── Blockchain Integration (populated after Phase 2 deployment) ──────────
    /**
     * startupWallet: the wallet executing the campaign creation (if needed for indexings).
     */
    startupWallet: {
      type: String,
      default: null,
      match: [
        /^0x[a-fA-F0-9]{40}$/i,
        'startupWallet must be a valid Ethereum address',
      ],
      lowercase: true,
    },

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
        /^0x[a-fA-F0-9]{64}$/i,
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
     * createCampaignTxHash: the on-chain tx hash from the createCampaign() call.
     * Populated by activateCampaign controller after successful tx.wait().
     * Null for campaigns that were created before blockchain integration.
     */
    createCampaignTxHash: {
      type: String,
      default: null,
    },

    createdAtBlock: {
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

    sourceOfTruth: {
      type: String,
      enum: ['blockchain', 'local'],
      default: 'blockchain',
    },

    // Removed activationTxHash as it is superseded by createCampaignTxHash
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
campaignSchema.index({ localStatus: 1 });
campaignSchema.index({ onChainStatus: 1 });
campaignSchema.index({ deadline: 1 });
campaignSchema.index({ currency: 1 });

// Compound: find active campaigns efficiently for discovery page
campaignSchema.index({ onChainStatus: 1, createdAt: -1 });

// Indexes for common filters
campaignSchema.index({ sector: 1 });
campaignSchema.index({ riskScore: 1 });
campaignSchema.index({ returnPotential: 1 });
campaignSchema.index({ fundingStage: 1 });
campaignSchema.index({ startupWallet: 1 });

// Compound: find all campaigns for a startup (dashboard query)
campaignSchema.index({ userId: 1, localStatus: 1, onChainStatus: 1 });

// Sparse unique on campaignKey (nulls excluded)
campaignSchema.index({ campaignKey: 1 }, { unique: true, sparse: true });

// Text search on title and summary
campaignSchema.index(
  { title: 'text', summary: 'text' },
  { name: 'campaign_text_search' }
);

const Campaign = mongoose.model('Campaign', campaignSchema);

module.exports = Campaign;
