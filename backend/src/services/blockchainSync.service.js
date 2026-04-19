/**
 * src/services/blockchainSync.service.js
 *
 * Robust background synchronization service.
 * Tracks global progress in BlockchainSyncMetadata and prevents duplicates via BlockchainSyncLedger.
 */

'use strict';

const { getProvider, getReadContract, isBlockchainConfigured } = require('../config/blockchain');
const Campaign = require('../models/Campaign');
const Investment = require('../models/Investment');
const Milestone = require('../models/Milestone');
const EvidenceBundle = require('../models/EvidenceBundle');
const BlockchainSyncMetadata = require('../models/BlockchainSyncMetadata');
const BlockchainSyncLedger = require('../models/BlockchainSyncLedger');

let syncInterval = null;
const SYNC_SERVICE_NAME = 'main-event-sync';
const REORG_SAFETY_MARGIN = 5; // Process up to currentBlock - 5
const MAX_BLOCKS_PER_QUERY = 1000; // Limit range for RPC stability

/**
 * Main synchronization loop.
 */
async function runSyncCycle() {
  if (!isBlockchainConfigured()) return;

  try {
    const provider = getProvider();
    const contract = getReadContract();
    
    // 1. Determine scan range
    const currentBlock = await provider.getBlockNumber();
    const safeBlock = currentBlock - REORG_SAFETY_MARGIN;

    let metadata = await BlockchainSyncMetadata.findOne({ serviceName: SYNC_SERVICE_NAME });
    if (!metadata) {
      // First run: start from safeBlock or contract deployment block
      // We'll default to 0 and let the range be limited by fallback or config
      metadata = await BlockchainSyncMetadata.create({
        serviceName: SYNC_SERVICE_NAME,
        lastSyncedBlock: Math.max(0, safeBlock - 100) // Default to scanning last 100 blocks if new
      });
    }

    const fromBlock = metadata.lastSyncedBlock + 1;
    let toBlock = Math.min(fromBlock + MAX_BLOCKS_PER_QUERY, safeBlock);

    if (fromBlock > toBlock) {
      return; // Up to date
    }

    console.log(`[BlockchainSync] Syncing range: ${fromBlock} -> ${toBlock} (Safe Head: ${safeBlock})`);

    // 2. Fetch and process logs for all events
    // We fetch all events from the contract in this range
    const events = await contract.queryFilter('*', fromBlock, toBlock);
    
    // Sort events by block number and transaction index to ensure consistent processing order
    events.sort((a, b) => {
      if (a.blockNumber !== b.blockNumber) return a.blockNumber - b.blockNumber;
      return a.transactionIndex - b.transactionIndex;
    });

    for (const event of events) {
      await secureProcessEvent(event);
    }

    // 3. Update metadata progress
    metadata.lastSyncedBlock = toBlock;
    metadata.updatedAt = new Date();
    await metadata.save();

  } catch (error) {
    console.error('[BlockchainSync] Error in sync cycle:', error);
  }
}

/**
 * Gatekeeper for event processing. Checks ledger for idempotency.
 */
async function secureProcessEvent(event) {
  const txHash = event.transactionHash.toLowerCase();
  const eventName = event.fragment ? event.fragment.name : 'Unknown';

  if (eventName === 'Unknown') return;

  // Check if already processed
  const existing = await BlockchainSyncLedger.findOne({ txHash });
  if (existing) {
    if (existing.status === 'processed') return; 
    // If failed, we might want to retry. For now, we only skip if "processed" or "skipped"
    if (existing.status === 'skipped') return;
  }

  // Record placeholder to prevent concurrent processing (though loop is serial)
  let ledgerEntry = existing || new BlockchainSyncLedger({
    txHash,
    eventName,
    blockNumber: event.blockNumber,
    source: 'sync-service',
    status: 'skipped' // Default until success
  });

  try {
    const success = await dispatchEvent(eventName, event);
    
    if (success) {
      ledgerEntry.status = 'processed';
      ledgerEntry.metadata = serializeArgs(event.args);
      await ledgerEntry.save();
    }
  } catch (err) {
    console.error(`[BlockchainSync] Failed to process ${eventName} at ${txHash}:`, err);
    ledgerEntry.status = 'failed';
    ledgerEntry.error = err.message;
    await ledgerEntry.save();
  }
}

/**
 * Routes events to specific handlers.
 */
async function dispatchEvent(name, event) {
  switch (name) {
    case 'CampaignCreated':
      return await handleCampaignCreated(event);
    case 'InvestmentReceived':
      return await handleInvestmentReceived(event);
    case 'MilestoneEvidenceSubmitted':
      return await handleEvidenceSubmitted(event);
    case 'MilestoneEvidenceApproved':
      return await handleEvidenceApproved(event);
    case 'MilestoneEvidenceRejected':
      return await handleEvidenceRejected(event);
    case 'MilestoneReleased':
      return await handleMilestoneReleased(event);
    case 'CampaignCompleted':
      return await handleCampaignCompleted(event);
    default:
      return false; // Unknown event, ignore
  }
}

// ─── Event Handlers ──────────────────────────────────────────────────────────

async function handleCampaignCreated(event) {
  const { campaignKey } = event.args;
  await Campaign.findOneAndUpdate(
    { campaignKey },
    {
      $set: {
        onChainStatus: 'active',
        createCampaignTxHash: event.transactionHash,
        createdAtBlock: event.blockNumber,
        syncStatus: 'confirmed',
        lastSyncedAt: new Date()
      }
    }
  );
  return true;
}

async function handleInvestmentReceived(event) {
  const { campaignKey, investor, amount, totalRaised } = event.args;
  
  const block = await event.getBlock();
  const confirmedAt = new Date(block.timestamp * 1000);

  // Update or insert Investment record
  await Investment.findOneAndUpdate(
    { txHash: event.transactionHash.toLowerCase() },
    {
      $set: {
        campaignKey: campaignKey,
        investorWallet: investor.toLowerCase(),
        amountWei: amount.toString(),
        blockNumber: event.blockNumber,
        confirmedAt: confirmedAt,
        syncStatus: 'confirmed'
      }
    },
    { upsert: true }
  );

  // Update Campaign total raised
  await Campaign.findOneAndUpdate(
    { campaignKey: campaignKey },
    { $set: { totalRaisedWei: totalRaised.toString() } }
  );
  
  return true;
}

async function handleEvidenceSubmitted(event) {
  const { campaignKey, milestoneIndex, evidenceHash, summaryHash } = event.args;
  const block = await event.getBlock();
  
  await EvidenceBundle.findOneAndUpdate(
    { campaignKey, milestoneIndex: Number(milestoneIndex), onChainStatus: 'anchoring' },
    {
      $set: {
        onChainStatus: 'anchored',
        submitTxHash: event.transactionHash,
        anchoredAt: new Date(block.timestamp * 1000),
        evidenceHash,
        summaryHash
      }
    },
    { sort: { createdAt: -1 } }
  );
  return true;
}

async function handleEvidenceApproved(event) {
  const { campaignKey, milestoneIndex } = event.args;
  const block = await event.getBlock();
  const approvedAt = new Date(block.timestamp * 1000);

  await EvidenceBundle.findOneAndUpdate(
    { campaignKey, milestoneIndex: Number(milestoneIndex), onChainStatus: 'anchored' },
    {
      $set: {
        onChainStatus: 'approved',
        approveTxHash: event.transactionHash,
        approvedAt
      }
    },
    { sort: { createdAt: -1 } }
  );
  
  const campaign = await Campaign.findOne({ campaignKey }).select('_id');
  if (campaign) {
    await Milestone.findOneAndUpdate(
      { campaignId: campaign._id, milestoneIndex: Number(milestoneIndex) },
      { $set: { reviewStatus: 'approved', approvedAt } }
    );
  }
  return true;
}

async function handleEvidenceRejected(event) {
  const { campaignKey, milestoneIndex, reason } = event.args;
  const block = await event.getBlock();
  const rejectedAt = new Date(block.timestamp * 1000);

  await EvidenceBundle.findOneAndUpdate(
    { campaignKey, milestoneIndex: Number(milestoneIndex), onChainStatus: 'anchored' },
    {
      $set: {
        onChainStatus: 'rejected',
        rejectTxHash: event.transactionHash,
        rejectedAt,
        rejectionReason: reason
      }
    },
    { sort: { createdAt: -1 } }
  );
  
  const campaign = await Campaign.findOne({ campaignKey }).select('_id');
  if (campaign) {
    await Milestone.findOneAndUpdate(
      { campaignId: campaign._id, milestoneIndex: Number(milestoneIndex) },
      { $set: { reviewStatus: 'rejected', rejectedAt, rejectionReason: reason } }
    );
  }
  return true;
}

async function handleMilestoneReleased(event) {
  const { campaignKey, milestoneIndex, amount } = event.args;
  const block = await event.getBlock();
  const releasedAt = new Date(block.timestamp * 1000);

  const campaign = await Campaign.findOne({ campaignKey }).select('_id');
  if (campaign) {
    await Milestone.findOneAndUpdate(
      { campaignId: campaign._id, milestoneIndex: Number(milestoneIndex) },
      {
        $set: {
          onChainStatus: 'released',
          releaseTxHash: event.transactionHash,
          releasedAmountWei: amount.toString(),
          releasedAt,
          releasedAtBlock: event.blockNumber,
          syncStatus: 'confirmed',
          lastSyncedAt: new Date()
        }
      }
    );
  }
  return true;
}

async function handleCampaignCompleted(event) {
  const { campaignKey, totalRaised } = event.args;
  await Campaign.findOneAndUpdate(
    { campaignKey },
    {
      $set: {
        onChainStatus: 'completed',
        totalRaisedWei: totalRaised.toString(),
        syncStatus: 'confirmed',
        lastSyncedAt: new Date()
      }
    }
  );
  return true;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function serializeArgs(args) {
  const result = {};
  if (!args) return result;
  // Convert BigInts to strings for JSON storage
  for (const key of Object.keys(args)) {
    if (isNaN(key)) { // Ignore numeric indices
      const val = args[key];
      result[key] = (typeof val === 'bigint') ? val.toString() : val;
    }
  }
  return result;
}

/**
 * Start the sync service.
 */
function startSyncService(intervalMs = 30000) {
  if (!isBlockchainConfigured()) {
    console.log('[BlockchainSync] Blockchain not configured. Sync service disabled.');
    return;
  }
  
  console.log('[BlockchainSync] Starting robust background sync service...');
  
  // Initial run
  runSyncCycle();

  syncInterval = setInterval(runSyncCycle, intervalMs);
}

function stopSyncService() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
    console.log('[BlockchainSync] Stopped background sync service.');
  }
}

module.exports = {
  startSyncService,
  stopSyncService,
  runSyncCycle,
  secureProcessEvent // Export for manual/immediate use
};
