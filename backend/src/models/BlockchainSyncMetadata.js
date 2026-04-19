/**
 * src/models/BlockchainSyncMetadata.js
 *
 * Persists the state of the blockchain synchronization service.
 * Used to resume syncing from the correct block after process restarts.
 */

const mongoose = require('mongoose');

const BlockchainSyncMetadataSchema = new mongoose.Schema({
  // Unique identifier for the sync service (allowing for potential multi-chain support later)
  serviceName: {
    type: String,
    required: true,
    unique: true,
    default: 'main-event-sync'
  },
  
  // The last block number successfully processed by the sync service
  lastSyncedBlock: {
    type: Number,
    required: true,
    default: 0
  },
  
  // Status of the sync service
  status: {
    type: String,
    enum: ['active', 'maintenance', 'paused'],
    default: 'active'
  },
  
  // Last time the sync service reported progress
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('BlockchainSyncMetadata', BlockchainSyncMetadataSchema);
