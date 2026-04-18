/**
 * src/models/Investment.js
 *
 * Investment — a single on-chain investment event recorded by the backend.
 * Created by the investor after their tx.wait() completes on the frontend.
 *
 * ─── Design Decisions ────────────────────────────────────────────────────────
 *
 * 1. Amount storage (both fields kept):
 *    - amount:    Number  (INR, human-readable decimal, e.g. 5.0)
 *                Used for currentRaised updates and display queries.
 *    - amountWei: String (exact wei from blockchain event, e.g. "5000000000000000000")
 *                Stored as String to avoid JavaScript's 53-bit integer limit.
 *                Null in stub mode (no on-chain event to decode).
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
      default: null,
      match: [
        /^0x[a-fA-F0-9]{64}$/,
        'txHash must be a valid Ethereum transaction hash (0x + 64 hex chars)',
      ],
    },

    /**
     * walletAddress: the investor's EOA that signed the invest() transaction.
     * Sourced from the InvestmentReceived event in on-chain mode.
     * Provided by the investor in stub mode.
     */
    walletAddress: {
      type: String,
      default: null,
      match: [
        /^0x[a-fA-F0-9]{40}$/,
        'walletAddress must be a valid Ethereum address',
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

    // UPDATED FOR BLOCKCHAIN TRANSPARENCY LAYER
    blockchainTxHash: {
      type: String,
      default: null,
      match: [
        /^0x[a-fA-F0-9]{64}$/,
        'txHash must be a valid Ethereum transaction hash (0x + 64 hex chars)',
      ],
    },
    blockchainStatus: {
      type: String,
      enum: ['pending', 'logged', 'failed', 'skipped'],
      default: 'skipped',
    },
    blockchainError: {
      type: String,
      default: null,
    },

    // ── Amount ────────────────────────────────────────────────────────────────

    /**
     * amount: investment in INR as a decimal number.
     * In on-chain mode: decoded from InvestmentReceived event, converted via formatEther.
     * In stub mode: taken directly from the request body.
     * This is the authoritative amount for MongoDB state (currentRaised).
     */
    amount: {
      type: Number,
      required: [true, 'Investment amount is required'],
      min: [0.0001, 'Investment amount must be greater than 0'],
    },

    /**
     * amountWei: exact wei value from the blockchain event as a string.
     * Stored as String to safely represent values beyond JavaScript's safe integer.
     * Null in stub mode.
     * Example: "5000000000000000000" for 5 INR.
     */
    amountWei: {
      type: String,
      default: null,
    },

    // ── Token / Chain ─────────────────────────────────────────────────────────

    currency: {
      type: String,
      enum: {
        values: ['INR', 'ETH', 'INR', 'USD'],
        message: 'Currency must be INR, ETH, INR or USD',
      },
      default: 'INR',
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
     * status values:
     *   confirmed   → txHash verified, event decoded, amounts match (on-chain mode)
     *   unverified  → stub mode: accepted without blockchain verification
     *   failed      → txHash found but tx reverted, or verification mismatch
     *
     * Note: 'pending' status is not stored in the DB. The backend performs
     * synchronous verification before inserting. If verification fails, it
     * throws and nothing is inserted.
     */
    status: {
      type: String,
      enum: {
        values: ['confirmed', 'unverified', 'failed'],
        message: 'Invalid investment status',
      },
      required: [true, 'Investment status is required'],
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
investmentSchema.index({ status: 1, createdAt: -1 });

const Investment = mongoose.model('Investment', investmentSchema);

module.exports = Investment;
