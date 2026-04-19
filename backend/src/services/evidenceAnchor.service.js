/**
 * src/services/evidenceAnchor.service.js
 *
 * Submits milestone evidence hashes to the InvestmentPlatform smart contract
 * using the admin signer. This is the ONLY place that calls
 * contract.submitMilestoneEvidenceHash().
 *
 * ── Flow ─────────────────────────────────────────────────────────────────────
 *   1. Caller passes an EvidenceBundle document (already saved to MongoDB).
 *   2. This service builds the bytes32 args from the stored 0x hashes.
 *   3. Sends the tx and waits 1 confirmation.
 *   4. Verifies the MilestoneEvidenceSubmitted event is in the receipt.
 *   5. Updates the bundle in MongoDB: onChainStatus → 'anchored', submitTxHash.
 *   6. Returns { txHash, blockNumber, anchoredAt }.
 *
 * ── Retry Safety ─────────────────────────────────────────────────────────────
 *   If the process crashes after step 3 but before step 5:
 *     - The anchorRetry.job polls bundles stuck in 'processed' or 'anchor_failed'
 *       and calls anchorBundle() again.
 *     - The contract safely rejects double-submission of the same hashes
 *       (MilestoneStatus.Submitted → contract revert "Already submitted").
 *     - We catch that revert and instead call recoverAnchoredBundle() to look up
 *       the historical event log and patch MongoDB without re-submitting.
 *
 * ── On-chain payload (never includes raw file content) ───────────────────────
 *   submitMilestoneEvidenceHash(
 *     bytes32 campaignKey,
 *     uint8   milestoneIndex,
 *     bytes32 evidenceHash,    ← keccak256 of sorted file hashes
 *     bytes32 summaryHash      ← keccak256 of stable summary JSON
 *   )
 *
 * ── Determinism guarantee ─────────────────────────────────────────────────────
 *   evidenceHash and summaryHash are computed by hash.util.js from file buffers.
 *   They are written to MongoDB first (onChainStatus: 'processed').
 *   The on-chain anchor MUST exactly match what is in MongoDB.
 *   This service reads from MongoDB — it never recomputes hashes from files.
 */

'use strict';

const { ethers }                          = require('ethers');
const { getContract, getProvider,
        isBlockchainConfigured }          = require('../config/blockchain');
const EvidenceBundle                      = require('../models/EvidenceBundle');
const { ApiError }                        = require('../middleware/errorHandler');

// ─── Event interface for log parsing ─────────────────────────────────────────

const EVIDENCE_SUBMITTED_TOPIC = ethers.id(
  'MilestoneEvidenceSubmitted(bytes32,uint8,bytes32,bytes32)'
);

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Normalise a 0x-prefixed 66-char hex to a bytes32 value for the contract.
 * ethers v6 accepts hex strings directly in contract calls.
 * The contract stores/emits them as bytes32.
 */
function toBytes32(hex) {
  if (!hex || !/^0x[a-fA-F0-9]{64}$/.test(hex)) {
    throw new Error(`evidenceAnchor: invalid bytes32 hex value: ${hex}`);
  }
  return hex; // ethers v6 encodes "0x..." strings as bytes32 automatically
}

/**
 * Parse a MilestoneEvidenceSubmitted event log from a receipt.
 * Returns { campaignKey, milestoneIndex, evidenceHash, summaryHash } or null.
 */
function parseEvidenceSubmittedLog(contract, receipt) {
  for (const log of receipt.logs) {
    if (log.topics[0] !== EVIDENCE_SUBMITTED_TOPIC) continue;
    try {
      const parsed = contract.interface.parseLog(log);
      if (parsed && parsed.name === 'MilestoneEvidenceSubmitted') {
        return {
          campaignKey:    parsed.args.campaignKey,
          milestoneIndex: Number(parsed.args.milestoneIndex),
          evidenceHash:   parsed.args.evidenceHash,
          summaryHash:    parsed.args.summaryHash,
        };
      }
    } catch {
      // non-matching log — skip
    }
  }
  return null;
}

/**
 * Look up a past MilestoneEvidenceSubmitted event for a given bundle.
 * Used during crash-recovery when the tx went through but MongoDB was not updated.
 *
 * @param {EthersContract} contract   read-only contract instance
 * @param {string} campaignKey        0x-prefixed bytes32
 * @param {number} milestoneIndex     0-based
 * @returns {Promise<{txHash, blockNumber, timestamp}|null>}
 */
async function findHistoricAnchorEvent(contract, campaignKey, milestoneIndex) {
  try {
    const filter = contract.filters.MilestoneEvidenceSubmitted(campaignKey);
    const events = await contract.queryFilter(filter, -10000); // last 10k blocks
    const match = events.find(e => Number(e.args.milestoneIndex) === milestoneIndex);
    if (!match) return null;
    const block = await match.getBlock();
    return {
      txHash:      match.transactionHash,
      blockNumber: match.blockNumber,
      timestamp:   new Date(block.timestamp * 1000),
    };
  } catch {
    return null;
  }
}

// ─── Public: anchorBundle ─────────────────────────────────────────────────────

/**
 * Submit a bundle's hashes on-chain and update MongoDB.
 *
 * @param {string|mongoose.Types.ObjectId} bundleId  EvidenceBundle._id
 * @returns {Promise<{
 *   txHash:      string,
 *   blockNumber: number,
 *   anchoredAt:  Date,
 *   recovered:   boolean   // true if we recovered from a crash (no new tx)
 * }>}
 * @throws {ApiError} 503 if blockchain not configured
 * @throws {ApiError} 400 if bundle not found or already anchored
 */
async function anchorBundle(bundleId) {
  if (!isBlockchainConfigured()) {
    throw new ApiError(
      'Blockchain not configured — cannot anchor evidence. ' +
      'Set ALCHEMY_RPC_URL, ADMIN_WALLET_PRIVATE_KEY, CONTRACT_ADDRESS.',
      503
    );
  }

  // ── 1. Load bundle ────────────────────────────────────────────────────────

  const bundle = await EvidenceBundle.findById(bundleId);
  if (!bundle) {
    throw new ApiError(`Evidence bundle ${bundleId} not found`, 404);
  }

  if (bundle.onChainStatus === 'anchored' ||
      bundle.onChainStatus === 'approved' ||
      bundle.onChainStatus === 'released') {
    return {
      txHash:      bundle.submitTxHash,
      blockNumber: null,
      anchoredAt:  bundle.anchoredAt,
      recovered:   false,
      alreadyAnchored: true,
    };
  }

  const { campaignKey, milestoneIndex, evidenceHash, summaryHash } = bundle;

  if (!evidenceHash || !summaryHash) {
    throw new ApiError(`Bundle ${bundleId} is missing computed hashes`, 400);
  }

  const contract = getContract();

  // ── 2. Send tx ───────────────────────────────────────────────────────────

  // Mark as 'anchoring' immediately so crash-recovery job knows it's in flight
  bundle.onChainStatus = 'anchoring';
  await bundle.save();

  let tx;
  try {
    tx = await contract.submitMilestoneEvidenceHash(
      toBytes32(campaignKey),
      milestoneIndex,
      toBytes32(evidenceHash),
      toBytes32(summaryHash)
    );
  } catch (err) {
    // Check if this is a revert because already submitted (crash-recovery path)
    const msg = (err.shortMessage || err.reason || err.message || '').toLowerCase();
    if (msg.includes('already') || msg.includes('submitted') || msg.includes('not submitted')) {
      // The tx already went through in a previous attempt — recover from event logs
      return await _recoverFromHistory(bundle, contract, campaignKey, milestoneIndex);
    }

    bundle.onChainStatus = 'anchor_failed';
    bundle.anchorError = `sendTx failed: ${err.shortMessage || err.message}`;
    await bundle.save();

    throw new ApiError(
      `Evidence anchor tx failed: ${err.shortMessage || err.reason || err.message}`,
      502
    );
  }

  // ── 3. Wait for confirmation ──────────────────────────────────────────────

  let receipt;
  try {
    receipt = await tx.wait(1);
  } catch (err) {
    bundle.onChainStatus = 'anchor_failed';
    bundle.anchorError = `waitForReceipt failed: ${err.shortMessage || err.message}`;
    bundle.submitTxHash = tx.hash; // save the tx hash even if confirmation failed
    await bundle.save();

    throw new ApiError(
      `Evidence anchor tx sent (${tx.hash}) but confirmation failed: ` +
      `${err.shortMessage || err.message}`,
      504
    );
  }

  // ── 4. Verify event was emitted ───────────────────────────────────────────

  const emitted = parseEvidenceSubmittedLog(contract, receipt);
  if (!emitted) {
    bundle.onChainStatus = 'anchor_failed';
    bundle.anchorError = `MilestoneEvidenceSubmitted event not found in receipt ${receipt.hash}`;
    bundle.submitTxHash = receipt.hash;
    await bundle.save();

    throw new ApiError(
      `Evidence anchor tx confirmed (${receipt.hash}) but expected event was not emitted. ` +
      'The contract may have reverted silently or the ABI is out of sync.',
      502
    );
  }

  // ── 5. Update MongoDB ─────────────────────────────────────────────────────

  const anchoredAt    = new Date();
  bundle.submitTxHash  = receipt.hash;
  bundle.anchoredAt    = anchoredAt;
  bundle.onChainStatus = 'anchored';
  bundle.anchorError   = null;
  await bundle.save();

  console.log(
    `[evidenceAnchor] ✅ Anchored bundle ${bundleId} | ` +
    `campaignKey ${campaignKey.slice(0, 10)}... | ` +
    `milestone ${milestoneIndex} | tx ${receipt.hash}`
  );

  return {
    txHash:      receipt.hash,
    blockNumber: receipt.blockNumber,
    anchoredAt,
    recovered:   false,
  };
}

// ─── Internal: crash-recovery ─────────────────────────────────────────────────

async function _recoverFromHistory(bundle, contract, campaignKey, milestoneIndex) {
  console.log(
    `[evidenceAnchor] ⚡ Crash-recovery for bundle ${bundle._id} — ` +
    'looking up historic MilestoneEvidenceSubmitted event'
  );

  const historic = await findHistoricAnchorEvent(contract, campaignKey, milestoneIndex);

  if (historic) {
    bundle.submitTxHash  = historic.txHash;
    bundle.anchoredAt    = historic.timestamp;
    bundle.onChainStatus = 'anchored';
    bundle.anchorError   = null;
    await bundle.save();

    console.log(`[evidenceAnchor] ✅ Recovered bundle ${bundle._id} from tx ${historic.txHash}`);

    return {
      txHash:      historic.txHash,
      blockNumber: historic.blockNumber,
      anchoredAt:  historic.timestamp,
      recovered:   true,
    };
  }

  // Could not find the event — mark failed and surface for manual review
  bundle.onChainStatus = 'anchor_failed';
  bundle.anchorError   = 'Contract rejected resubmission but no historic event found. Manual review required.';
  await bundle.save();

  throw new ApiError(
    `Anchor recovery failed for bundle ${bundle._id}. ` +
    'Contract rejected but no matching on-chain event found. Manual review required.',
    502
  );
}

// ─── Public: confirmAnchor ────────────────────────────────────────────────────

/**
 * Re-check an 'anchored' bundle's tx receipt to confirm the event is on-chain.
 * Called from the reconciliation logic.
 *
 * @param {string} bundleId
 * @returns {Promise<boolean>} true if anchor is verified on-chain
 */
async function confirmAnchor(bundleId) {
  const bundle = await EvidenceBundle.findById(bundleId).select(
    'submitTxHash onChainStatus evidenceHash summaryHash'
  );
  if (!bundle || !bundle.submitTxHash) return false;

  try {
    const provider = getProvider();
    const receipt  = await provider.getTransactionReceipt(bundle.submitTxHash);
    if (!receipt || receipt.status !== 1) return false;

    const contract = getContract();
    const emitted  = parseEvidenceSubmittedLog(contract, receipt);
    return !!emitted;
  } catch {
    return false;
  }
}

// ─── Public: listStuckBundles ─────────────────────────────────────────────────

/**
 * Returns bundles that need retry — either never anchored or failed.
 * Used by the retry job.
 */
async function listStuckBundles(olderThanMinutes = 5) {
  const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000);
  return EvidenceBundle.find({
    onChainStatus: { $in: ['processed', 'anchor_failed'] },
    updatedAt:    { $lt: cutoff },
  })
    .select('_id campaignKey milestoneIndex evidenceHash summaryHash onChainStatus anchorError')
    .lean();
}

module.exports = {
  anchorBundle,
  confirmAnchor,
  listStuckBundles,
};
