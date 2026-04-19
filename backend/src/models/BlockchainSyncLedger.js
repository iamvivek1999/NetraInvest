/**
 * src/models/BlockchainSyncLedger.js
 *
 * Audit log and idempotency guard for all processed on-chain transactions.
 * Prevents the system from processing the same event multiple times.
 */

const mongoose = require('mongoose');

const BlockchainSyncLedgerSchema = new mongoose.Schema({
  // The transaction hash of the event
  txHash: {
    type: String,
    required: true,
    unique: true,
    index: true,
    lowercase: true
  },
  
  // The name of the event (e.g., CampaignCreated, InvestmentReceived)
  eventName: {
    type: String,
    required: true,
    index: true
  },
  
  // The block number where the event occurred
  blockNumber: {
    type: Number,
    required: true,
    index: true
  },
  
  // Status of the processing
  status: {
    type: String,
    enum: ['processed', 'failed', 'skipped'],
    default: 'processed'
  },
  
  // Error message if processing failed
  error: {
    type: String
  },
  
  // The source of the sync (e.g., 'sync-service', 'immediate-verification', 'admin-manual')
  source: {
    type: String,
    required: true
  },
  
  // Parsed arguments from the event for debugging/audit
  metadata: {
    type: mongoose.Schema.Types.Mixed
  },
  
  // When it was first processed
  processedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Create a compound index for event name and block number for specialized queries
BlockchainSyncLedgerSchema.index({ eventName: 1, blockNumber: -1 });

module.exports = mongoose.model('BlockchainSyncLedger', BlockchainSyncLedgerSchema);
