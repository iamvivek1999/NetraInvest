/**
 * src/models/Investment.js
 *
 * Investment — a single on-chain investment event recorded by the backend.
 * Created by the investor after their tx.wait() completes on the frontend.
 *
 * ─── Design Decisions ────────────────────────────────────────────────────────
 *
 * 1. Amount storage (both fields kept):
 *    - amount:    Number  (POL decimal, human-readable, e.g. 0.5)
 *                In on-chain mode: decoded from InvestmentReceived event via formatEther.
 *                In stub mode: taken directly from request body.
 *                Used for MongoDB display queries (currentRaised display cache).
 *    - amountWei: String (exact wei from blockchain event, e.g. "500000000000000000")
 *                Stored as String to avoid JavaScript's 53-bit integer limit.
 *                Null in stub mode (no on-chain event to decode).
 *                This is the authoritative financial value.
 *
 * 2. Idempotency:
 *    txHash has a sparse unique index — once a txHash is recorded it cannot be
 *    recorded again (prevents double-counting). Sparse means null txHashes
 *    (stub mode) are excluded from uniqueness enforcement.
 *
 * 3. Status lifecycle:
 *    pending     → txHash submitted by frontend, backend verification underway
 *    confirmed   → txHash verified on-chain, event decoded, amounts match
 *    unverified  → stub mode: no on-chain verification performed
 *    failed      → tx found on-chain but status = 0 (reverted), or verification mismatch
 *
 * 4. Denormalized fields (startupProfileId, campaignKey):
 *    Copied at creation time to avoid joins on common read paths
 *    (investor dashboard, startup dashboard, admin review).
 *
 * 5. An investor can invest multiple times in the same campaign.
 *    investorCount on Campaign is only incremented on first investment per investor.
 *    Each investment is its own separate document.
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

const investmentSchema = new Schema(
  {
    // ── Relationships ─────────────────────────────────────────────────────────

    campaignId: {
      type: Schema.Types.ObjectId,
      ref: 'Campaign',
      required: [true, 'Campaign reference is required'],
    },

    // Denormalized for startup dashboard queries without joining Campaign
    startupProfileId: {
      type: Schema.Types.ObjectId,
      ref: 'StartupProfile',
      required: [true, 'Startup profile reference is required'],
    },

    // The investor user who made this investment
    investorUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Investor user reference is required'],
    },

    // ── Blockchain Identity ───────────────────────────────────────────────────

    /**
     * txHash: the transaction hash from the investor's invest() call.
     * Required in on-chain mode. Optional (null) in stub/demo mode.
     * Sparse unique index — prevents the same tx being recorded twice.
     */
    txHash: {
      type: String,
      match: [
        /^0x[a-fA-F0-9]{64}$/,
        'txHash must be a valid Ethereum transaction hash (0x + 64 hex chars)',
      ],
    },

    /**
     * investorWallet: the investor's EOA that signed the invest() transaction.
     * Sourced from the InvestmentReceived event in on-chain mode.
     * Provided by the investor in stub mode.
     */
    investorWallet: {
      type: String,
      default: null,
      match: [
        /^0x[a-fA-F0-9]{40}$/i,
        'investorWallet must be a valid Ethereum address',
      ],
      lowercase: true,
    },

    /**
     * campaignKey: bytes32 key linking this investment to the on-chain campaign.
     * Copied from Campaign.campaignKey at record time.
     * Null if campaign was not yet on-chain (stub mode where campaign is also stub).
     */
    campaignKey: {
      type: String,
      default: null,
    },

    /**
     * contractAddress: the InvestmentPlatform contract that received the funds.
     * Same for all on-chain investments. Null in stub mode.
     */
    contractAddress: {
      type: String,
      default: null,
      match: [
        /^0x[a-fA-F0-9]{40}$/,
        'contractAddress must be a valid Ethereum address',
      ],
    },

    // UPDATED FOR NON-BLOCKCHAIN PAYMENT FLOW
    paymentId: {
      type: String,
      default: null,
    },
    paymentProvider: {
      type: String,
      default: null,
    },
    
    // UPDATED FOR RAZORPAY PAYMENT FLOW
    paymentOrderId: {
      type: String,
      default: null,
    },

    // ── Amount ────────────────────────────────────────────────────────────────

    /**
     * amount: investment in POL as a decimal number (formatEther output).
     * In on-chain mode: decoded from InvestmentReceived event, converted via formatEther.
     * In stub mode: taken directly from the request body.
     * This is used for display only — amountWei is the authoritative value.
     */
    amount: {
      type: Number,
      required: [true, 'Investment amount is required'],
      min: [0.0001, 'Investment amount must be greater than 0'],
    },

    /**
     * amountWei: exact wei value from the blockchain event as a string.
     * Stored as String to safely represent values beyond JavaScript's safe integer.
     * This is the authoritative financial value. Null in stub mode.
     * Example: "500000000000000000" for 0.5 POL.
     */
    amountWei: {
      type: String,
      default: null,
    },

    // ── Token / Chain ─────────────────────────────────────────────────────────

    currency: {
      type: String,
      enum: {
        values: ['INR', 'ETH', 'POL', 'USD'],
        message: 'Currency must be INR, ETH, POL, or USD',
      },
      default: 'POL',
    },

    /**
     * chain: identifies which network this investment was made on.
     * Derived by the backend from env/config, not trusted from client input.
     *   polygon-amoy → Polygon Amoy testnet (current dev target)
     *   polygon      → Polygon mainnet
     *   hardhat      → Local Hardhat node (tests)
     *   stub         → No blockchain, demo/dev mode
     */
    chain: {
      type: String,
      enum: {
        values: ['polygon-amoy', 'polygon', 'hardhat', 'stub'],
        message: 'Invalid chain',
      },
      required: [true, 'Chain is required'],
    },

    // ── Status / Verification ─────────────────────────────────────────────────

    /**
     * syncStatus values:
     *   pending          — submitted, waiting for on-chain confirmation
     *   confirmed        — verified on-chain, amounts match
     *   failed           — tx reverted or verification failed
     *   resync_required  — mismatch detected during node sync, needs manual/auto re-eval
     *   stub             — DEV_STUB_BLOCKCHAIN_MODE only; no real on-chain proof exists
     */
    syncStatus: {
      type: String,
      enum: {
        values: ['pending', 'confirmed', 'failed', 'resync_required', 'stub'],
        message: 'Invalid investment syncStatus',
      },
      required: [true, 'Investment sync status is required'],
      default: 'pending',
    },

    /**
     * sourceOfTruth: determines if this record is authoritative mapped from blockchain,
     * or manually overridden/bypassed (e.g. stub or off-chain demo).
     */
    sourceOfTruth: {
      type: String,
      enum: ['blockchain', 'local'],
      default: 'blockchain',
    },

    /**
     * confirmedAt: timestamp of on-chain confirmation.
     * Derived from the block timestamp or Date.now() at insertion.
     * Null in failed status.
     */
    confirmedAt: {
      type: Date,
      default: null,
    },

    /**
     * blockNumber: the block in which the invest() tx was mined.
     * Null in stub mode.
     */
    blockNumber: {
      type: Number,
      default: null,
    },

    /**
     * logIndex: the specific log event index in the block.
     * Needed if a single tx handles multiple events.
     */
    logIndex: {
      type: Number,
      default: null,
    },

    /**
     * lastSyncedAt: Last time the worker verified this tx.
     */
    lastSyncedAt: {
      type: Date,
      default: null,
    },

    /**
     * verificationNote: human-readable note describing what verification path was taken.
     * e.g. "on-chain: InvestmentReceived event verified" or "stub: no verification"
     * Useful for debugging and audit log.
     */
    verificationNote: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

// Idempotency: unique on txHash, but sparse so null txHashes (stub mode) are excluded
investmentSchema.index({ txHash: 1 }, { unique: true, sparse: true });

// Investor's investment history
investmentSchema.index({ investorUserId: 1, createdAt: -1 });

// Campaign's investment list (for startup dashboard and campaign detail page)
investmentSchema.index({ campaignId: 1, createdAt: -1 });

// Startup's aggregated investment view (across all their campaigns)
investmentSchema.index({ startupProfileId: 1, createdAt: -1 });

// Compound: check if investor already has a confirmed investment in a campaign
// Used to determine whether to increment campaign.investorCount
investmentSchema.index({ campaignId: 1, investorUserId: 1 });

// Status-based admin queries
investmentSchema.index({ syncStatus: 1, createdAt: -1 });

const Investment = mongoose.model('Investment', investmentSchema);

module.exports = Investment;
