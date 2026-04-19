/**
 * src/controllers/milestoneEvidence.controller.js
 *
 * Handles all milestone evidence operations:
 *
 *   POST   /api/v1/campaigns/:campaignId/milestones/:milestoneIndex/evidence/upload
 *     → Upload 1-10 files, process locally, auto-anchor hashes on-chain via admin signer
 *
 *   GET    /api/v1/campaigns/:campaignId/milestones/:milestoneIndex/evidence
 *     → List all bundles for a milestone (latest first)
 *
 *   GET    /api/v1/campaigns/:campaignId/milestones/:milestoneIndex/evidence/latest
 *     → Most recent bundle with hashes + file serve URLs + on-chain status
 *
 *   POST   /api/v1/campaigns/:campaignId/milestones/:milestoneIndex/evidence/anchor
 *     → Admin: manually re-trigger anchor for a bundle (retry / manual override)
 *
 *   POST   /api/v1/campaigns/:campaignId/milestones/:milestoneIndex/evidence/approve
 *     → Admin: call approveMilestoneEvidence on-chain → bundle onChainStatus = 'approved'
 *
 *   POST   /api/v1/campaigns/:campaignId/milestones/:milestoneIndex/evidence/reject
 *     → Admin: call rejectMilestoneEvidence on-chain, store reason
 *
 *   POST   /api/v1/campaigns/:campaignId/milestones/:milestoneIndex/evidence/release
 *     → Admin: call releaseMilestone on-chain → transfer funds to startup wallet
 *
 *   GET    /api/v1/evidence/files/:bundleId/:fileIndex
 *     → Stream uploaded file (authenticated, no raw path in response)
 *
 *   GET    /api/v1/evidence/files/:bundleId/summary
 *     → Stream summary.json
 *
 * State machine (onChainStatus in EvidenceBundle):
 *   processed → anchoring → anchored → approved → released
 *                    ↓
 *               anchor_failed → (retry) → anchored
 *                                         ↓
 *                                      rejected → (resubmit)
 *
 * Access rules:
 *   - Upload:   startup (own campaigns only)
 *   - Anchor:   admin only (auto-triggered after upload)
 *   - Approve / Reject / Release:  admin only
 *   - List / Latest:  authenticated user (admin sees all, startup sees own)
 *   - File serve:  authenticated user
 *
 * Security:
 *   - File paths from MongoDB never shown to clients
 *   - Files served via bundleId + index only
 *   - Admin signer signs all contract transactions (never the startup's wallet)
 */

'use strict';

const Campaign        = require('../models/Campaign');
const Milestone       = require('../models/Milestone');
const EvidenceBundle  = require('../models/EvidenceBundle');
const storage         = require('../services/evidenceStorage.service');
const processor       = require('../services/evidenceProcessor.service');
const anchor          = require('../services/evidenceAnchor.service');
const {
  approveMilestoneOnChain,
  rejectMilestoneOnChain,
  releaseMilestoneOnChain,
}                     = require('../services/blockchain.service');
const { isBlockchainConfigured } = require('../config/blockchain');
const { CHAIN_CONFIG }           = require('../config/blockchain');
const sendResponse    = require('../utils/sendResponse');
const path            = require('path');

// ─── POST /upload ─────────────────────────────────────────────────────────────

/**
 * Upload milestone evidence files.
 * Flow:
 *   1. Validate campaign ownership and campaignKey presence
 *   2. Run evidenceProcessor.processEvidenceFiles() → hashes computed + files saved
 *   3. Persist EvidenceBundle to MongoDB (onChainStatus: 'processed')
 *   4. If blockchain is configured: call anchorBundle() to submit hashes on-chain now
 *      If anchor fails (RPC down etc.): bundle stays 'processed' → retry job picks it up
 *   5. Return bundle metadata + status to caller
 */
async function uploadEvidence(req, res) {
  const { campaignId, milestoneIndex } = req.params;

  // ── Validate campaign ────────────────────────────────────────────────────

  const campaign = await Campaign.findById(campaignId).select('campaignKey userId status milestoneCount currentMilestoneIndex title');
  if (!campaign) return sendResponse(res, 404, false, 'Campaign not found');

  if (!campaign.campaignKey) {
    return sendResponse(res, 400, false,
      'Campaign has no on-chain key. Activate the campaign on-chain first.'
    );
  }

  if (req.user.role === 'startup' && !campaign.userId.equals(req.user._id)) {
    return sendResponse(res, 403, false, 'You can only upload evidence for your own campaigns');
  }

  const idx = parseInt(milestoneIndex, 10);
  if (isNaN(idx) || idx < 0 || idx > 4) {
    return sendResponse(res, 400, false, 'milestoneIndex must be 0–4');
  }

  if (!req.files || req.files.length === 0) {
    return sendResponse(res, 400, false, 'No files provided. Use multipart/form-data with field name "files".');
  }

  const milestone = await Milestone.findOne({ campaignId, milestoneIndex: idx });

  // ── Process files (hash + save locally) ─────────────────────────────────

  const processed = await processor.processEvidenceFiles({
    campaignKey:    campaign.campaignKey,
    milestoneIndex: idx,
    files:          req.files,
    meta: {
      submittedBy:  req.user._id.toString(),
      title:        req.body.title       || null,
      description:  req.body.description || null,
    },
  });

  // ── Persist bundle to MongoDB ────────────────────────────────────────────

  const doc = await EvidenceBundle.create({
    campaignId,
    milestoneId:    milestone ? milestone._id : null,
    uploadedBy:     req.user._id,
    campaignKey:    campaign.campaignKey,
    milestoneIndex: idx,
    title:          req.body.title       || null,
    description:    req.body.description || null,
    evidenceFiles:  processed.evidenceFiles.map(f => ({
      originalName: f.originalName,
      savedName:    f.savedName,
      relativePath: f.relativePath,
      mimeType:     f.mimeType,
      category:     f.category,
      sizeBytes:    f.sizeBytes,
      fileHash:     f.fileHash,
    })),
    extractedPath:  processed.extractedPath,
    summaryPath:    processed.summaryPath,
    metadataPath:   processed.metadataPath,
    evidenceHash:   processed.evidenceHash,
    summaryHash:    processed.summaryHash,
    storageBackend: processed.storageBackend,
    uploadedAt:     new Date(),
    processedAt:    processed.processedAt,
    onChainStatus:  'processed',
  });

  // ── Sync with Milestone model ────────────────────────────────────────────

  if (milestone) {
    await Milestone.findByIdAndUpdate(milestone._id, {
      $set: {
        reviewStatus: 'submitted',
        rejectionReason: null, // Clear any previous rejection
        rejectedAt: null,
      }
    });
  }

  // ── Auto-anchor on-chain (non-blocking — failure doesn't fail the upload) ─

  let anchorResult = null;
  let anchorError  = null;

  if (isBlockchainConfigured()) {
    try {
      anchorResult = await anchor.anchorBundle(doc._id);
    } catch (err) {
      anchorError = err.message;
      // Bundle stays 'processed' or 'anchor_failed' — retry job handles it
      console.warn(`[uploadEvidence] Anchor failed for bundle ${doc._id}: ${err.message}`);
    }
  }

  // Reload to get latest onChainStatus after potential anchor update
  const latest = await EvidenceBundle.findById(doc._id).lean();

  // ── Response ─────────────────────────────────────────────────────────────

  return sendResponse(res, 201, true, 'Evidence uploaded and processed', {
    bundleId:       latest._id,
    onChainStatus:  latest.onChainStatus,
    evidenceHash:   latest.evidenceHash,
    summaryHash:    latest.summaryHash,
    fileCount:      latest.evidenceFiles.length,
    storageBackend: latest.storageBackend,
    processedAt:    latest.processedAt,
    submitTxHash:   latest.submitTxHash   || null,
    anchoredAt:     latest.anchoredAt     || null,
    anchorError:    anchorError           || null,
    // If blockchain not configured, tell the caller anchoring was skipped
    anchoringSkipped: !isBlockchainConfigured(),
    explorerUrl: latest.submitTxHash
      ? CHAIN_CONFIG.explorerTxUrl(latest.submitTxHash)
      : null,
    files: latest.evidenceFiles.map((f, i) => ({
      index:        i,
      originalName: f.originalName,
      mimeType:     f.mimeType,
      category:     f.category,
      sizeBytes:    f.sizeBytes,
      fileHash:     f.fileHash,
      serveUrl:     `/api/v1/evidence/files/${latest._id}/${i}`,
    })),
    summaryUrl: `/api/v1/evidence/files/${latest._id}/summary`,
  });
}

// ─── GET /evidence (list bundles) ─────────────────────────────────────────────

async function listBundles(req, res) {
  const { campaignId, milestoneIndex } = req.params;
  const idx = parseInt(milestoneIndex, 10);

  const campaign = await Campaign.findById(campaignId).select('userId campaignKey');
  if (!campaign) return sendResponse(res, 404, false, 'Campaign not found');

  if (req.user.role !== 'admin' && !campaign.userId.equals(req.user._id)) {
    return sendResponse(res, 403, false, 'Access denied');
  }

  const bundles = await EvidenceBundle
    .find({ campaignKey: campaign.campaignKey, milestoneIndex: idx })
    .sort({ createdAt: -1 })
    .select('-evidenceFiles.relativePath -extractedPath -summaryPath -metadataPath -anchorError')
    .lean();

  // Map each bundle to a safe response shape with serve URLs
  const safe = bundles.map(b => ({
    bundleId:       b._id,
    onChainStatus:  b.onChainStatus,
    evidenceHash:   b.evidenceHash,
    summaryHash:    b.summaryHash,
    fileCount:      b.evidenceFiles.length,
    submitTxHash:   b.submitTxHash,
    anchoredAt:     b.anchoredAt,
    uploadedAt:     b.uploadedAt,
    processedAt:    b.processedAt,
    storageBackend: b.storageBackend,
    title:          b.title,
    description:    b.description,
    explorerUrl:    b.submitTxHash ? CHAIN_CONFIG.explorerTxUrl(b.submitTxHash) : null,
  }));

  return sendResponse(res, 200, true, `Found ${safe.length} bundle(s)`, { bundles: safe });
}

// ─── GET /evidence/latest ──────────────────────────────────────────────────────

async function getLatestBundle(req, res) {
  const { campaignId, milestoneIndex } = req.params;
  const idx = parseInt(milestoneIndex, 10);

  const campaign = await Campaign.findById(campaignId).select('userId campaignKey');
  if (!campaign) return sendResponse(res, 404, false, 'Campaign not found');

  if (req.user.role !== 'admin' && !campaign.userId.equals(req.user._id)) {
    return sendResponse(res, 403, false, 'Access denied');
  }

  const bundle = await EvidenceBundle
    .findOne({ campaignKey: campaign.campaignKey, milestoneIndex: idx })
    .sort({ createdAt: -1 })
    .lean();

  if (!bundle) return sendResponse(res, 404, false, 'No evidence bundle found for this milestone');

  return sendResponse(res, 200, true, 'Latest evidence bundle', {
    bundle: _safeBundleView(bundle),
  });
}

// ─── POST /anchor (admin: manual re-anchor) ───────────────────────────────────

async function triggerAnchor(req, res) {
  const { campaignId, milestoneIndex } = req.params;
  const { bundleId } = req.body;

  if (!isBlockchainConfigured()) {
    return sendResponse(res, 503, false,
      'Blockchain not configured. Set ALCHEMY_RPC_URL, ADMIN_WALLET_PRIVATE_KEY, CONTRACT_ADDRESS.'
    );
  }

  // Resolve bundle — use bundleId if provided, else use latest for this milestone
  let bundle;
  if (bundleId) {
    bundle = await EvidenceBundle.findById(bundleId).lean();
  } else {
    const campaign = await Campaign.findById(campaignId).select('campaignKey');
    if (!campaign) return sendResponse(res, 404, false, 'Campaign not found');
    bundle = await EvidenceBundle
      .findOne({ campaignKey: campaign.campaignKey, milestoneIndex: parseInt(milestoneIndex, 10) })
      .sort({ createdAt: -1 })
      .lean();
  }

  if (!bundle) return sendResponse(res, 404, false, 'No evidence bundle found');

  const result = await anchor.anchorBundle(bundle._id);

  return sendResponse(res, 200, true, 'Anchor submitted', {
    bundleId:    bundle._id,
    txHash:      result.txHash,
    anchoredAt:  result.anchoredAt,
    recovered:   result.recovered,
    explorerUrl: CHAIN_CONFIG.explorerTxUrl(result.txHash),
  });
}

// ─── POST /approve (admin) ────────────────────────────────────────────────────

async function approveEvidence(req, res) {
  const { campaignId, milestoneIndex } = req.params;
  const idx = parseInt(milestoneIndex, 10);

  if (!isBlockchainConfigured()) {
    return sendResponse(res, 503, false, 'Blockchain not configured');
  }

  const campaign = await Campaign.findById(campaignId).select('campaignKey userId');
  if (!campaign) return sendResponse(res, 404, false, 'Campaign not found');

  const bundle = await EvidenceBundle
    .findOne({ campaignKey: campaign.campaignKey, milestoneIndex: idx })
    .sort({ createdAt: -1 });

  if (!bundle) return sendResponse(res, 404, false, 'No evidence bundle found for this milestone');

  if (bundle.onChainStatus !== 'anchored') {
    return sendResponse(res, 400, false,
      `Bundle must be 'anchored' before approval. Current status: ${bundle.onChainStatus}`
    );
  }

  const result = await approveMilestoneOnChain({
    campaignKey:    campaign.campaignKey,
    milestoneIndex: idx,
  });

  bundle.onChainStatus = 'approved';
  bundle.approveTxHash = result.txHash;
  bundle.approvedAt    = new Date();
  await bundle.save();

  // Mirror status to Milestone doc if it exists
  await Milestone.findOneAndUpdate(
    { campaignId, milestoneIndex: idx },
    { $set: { reviewStatus: 'approved', approvedAt: new Date() } }
  );

  return sendResponse(res, 200, true, 'Milestone evidence approved on-chain', {
    bundleId:    bundle._id,
    txHash:      result.txHash,
    explorerUrl: CHAIN_CONFIG.explorerTxUrl(result.txHash),
    onChainStatus: 'approved',
  });
}

// ─── POST /reject (admin) ─────────────────────────────────────────────────────

async function rejectEvidence(req, res) {
  const { campaignId, milestoneIndex } = req.params;
  const idx = parseInt(milestoneIndex, 10);
  const { reason } = req.body;

  if (!isBlockchainConfigured()) {
    return sendResponse(res, 503, false, 'Blockchain not configured');
  }
  if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
    return sendResponse(res, 400, false, 'A rejection reason (min 5 chars) is required');
  }

  const campaign = await Campaign.findById(campaignId).select('campaignKey');
  if (!campaign) return sendResponse(res, 404, false, 'Campaign not found');

  const bundle = await EvidenceBundle
    .findOne({ campaignKey: campaign.campaignKey, milestoneIndex: idx })
    .sort({ createdAt: -1 });

  if (!bundle) return sendResponse(res, 404, false, 'No evidence bundle found');

  if (bundle.onChainStatus !== 'anchored') {
    return sendResponse(res, 400, false,
      `Bundle must be 'anchored' before rejection. Current status: ${bundle.onChainStatus}`
    );
  }

  const result = await rejectMilestoneOnChain({
    campaignKey:    campaign.campaignKey,
    milestoneIndex: idx,
    reason:         reason.trim(),
  });

  bundle.onChainStatus    = 'rejected';
  bundle.rejectTxHash     = result.txHash;
  bundle.rejectedAt       = new Date();
  bundle.rejectionReason  = reason.trim();
  await bundle.save();

  await Milestone.findOneAndUpdate(
    { campaignId, milestoneIndex: idx },
    { $set: { reviewStatus: 'rejected', rejectedAt: new Date(), rejectionReason: reason.trim() } }
  );

  return sendResponse(res, 200, true, 'Milestone evidence rejected on-chain', {
    bundleId:    bundle._id,
    txHash:      result.txHash,
    explorerUrl: CHAIN_CONFIG.explorerTxUrl(result.txHash),
    onChainStatus: 'rejected',
  });
}

// ─── POST /release (admin) ────────────────────────────────────────────────────

async function releaseMilestoneFunds(req, res) {
  const { campaignId, milestoneIndex } = req.params;
  const idx = parseInt(milestoneIndex, 10);

  if (!isBlockchainConfigured()) {
    return sendResponse(res, 503, false, 'Blockchain not configured');
  }

  const campaign = await Campaign.findById(campaignId).select('campaignKey currentMilestoneIndex milestoneCount');
  if (!campaign) return sendResponse(res, 404, false, 'Campaign not found');

  // ── 1. Atomic Lock ─────────────────────────────────────────────────────────

  // Find the latest bundle for this milestone
  const latestBundle = await EvidenceBundle
    .findOne({ campaignKey: campaign.campaignKey, milestoneIndex: idx })
    .sort({ createdAt: -1 });

  if (!latestBundle) return sendResponse(res, 404, false, 'No evidence bundle found');

  // Atomically transition from 'approved' -> 'releasing'
  // Ensures only one concurrent request proceeds.
  const bundle = await EvidenceBundle.findOneAndUpdate(
    { 
      _id: latestBundle._id, 
      onChainStatus: 'approved' 
    },
    { $set: { onChainStatus: 'releasing' } },
    { new: true }
  );

  if (!bundle) {
    return sendResponse(res, 409, false, 
      `Milestone release is already in progress or has a different status (${latestBundle.onChainStatus}).`
    );
  }

  // ── 2. Blockchain Transaction ─────────────────────────────────────────────

  try {
    const result = await releaseMilestoneOnChain({
      campaignKey:    campaign.campaignKey,
      milestoneIndex: idx,
    });

    // ── 3. Success Updates ──────────────────────────────────────────────────

    bundle.onChainStatus = 'released';
    bundle.releaseTxHash = result.txHash;
    bundle.releasedAt    = new Date();
    await bundle.save();

    await Milestone.findOneAndUpdate(
      { campaignId, milestoneIndex: idx },
      { $set: {
        onChainStatus:     'released',
        releaseTxHash:     result.txHash,
        releasedAt:        new Date(),
        releasedAmountWei: result.amountWei || null,
      }
      }
    );

    // Advance currentMilestoneIndex
    const nextIndex = campaign.currentMilestoneIndex + 1;
    const isFinalMilestone = nextIndex >= campaign.milestoneCount;

    await Campaign.findByIdAndUpdate(campaignId, {
      $inc: { currentMilestoneIndex: 1 },
      ...(isFinalMilestone && { $set: { onChainStatus: 'completed' } }),
    });

    return sendResponse(res, 200, true, 'Milestone funds released on-chain', {
      bundleId:    bundle._id,
      txHash:      result.txHash,
      amountWei:   result.amountWei,
      explorerUrl: CHAIN_CONFIG.explorerTxUrl(result.txHash),
      onChainStatus: 'released',
    });

  } catch (err) {
    // ── 4. Error Recovery ───────────────────────────────────────────────────
    
    // Revert status to 'approved' so it can be retried
    await EvidenceBundle.findByIdAndUpdate(bundle._id, { 
      $set: { onChainStatus: 'approved' } 
    });

    console.error(`[releaseMilestoneFunds] Blockchain error: ${err.message}`);
    return sendResponse(res, 500, false, `Blockchain transaction failed: ${err.message}`);
  }
}

// ─── GET /evidence/files/:bundleId/:fileIndex ─────────────────────────────────

async function serveFile(req, res) {
  const { bundleId, fileIndex } = req.params;
  const idx = parseInt(fileIndex, 10);

  const bundle = await EvidenceBundle.findById(bundleId).select('evidenceFiles uploadedBy campaignId');
  if (!bundle) return sendResponse(res, 404, false, 'Evidence bundle not found');

  if (req.user.role !== 'admin') {
    const campaign = await Campaign.findById(bundle.campaignId).select('userId');
    if (!campaign || !campaign.userId.equals(req.user._id)) {
      return sendResponse(res, 403, false, 'Access denied');
    }
  }

  if (isNaN(idx) || idx < 0 || idx >= bundle.evidenceFiles.length) {
    return sendResponse(res, 404, false, 'File index out of range');
  }

  const file = bundle.evidenceFiles[idx];
  if (!storage.fileExists(file.relativePath)) {
    return sendResponse(res, 404, false, 'File not found in storage');
  }

  const absPath = storage.resolveServePath(file.relativePath);
  res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.originalName)}"`);
  res.sendFile(absPath);
}

// ─── GET /evidence/files/:bundleId/summary ────────────────────────────────────

async function serveSummary(req, res) {
  const { bundleId } = req.params;

  const bundle = await EvidenceBundle.findById(bundleId).select('summaryPath uploadedBy campaignId');
  if (!bundle) return sendResponse(res, 404, false, 'Evidence bundle not found');

  if (req.user.role !== 'admin') {
    const campaign = await Campaign.findById(bundle.campaignId).select('userId');
    if (!campaign || !campaign.userId.equals(req.user._id)) {
      return sendResponse(res, 403, false, 'Access denied');
    }
  }

  if (!bundle.summaryPath || !storage.fileExists(bundle.summaryPath)) {
    return sendResponse(res, 404, false, 'Summary not available');
  }

  const absPath = storage.resolveServePath(bundle.summaryPath);
  res.setHeader('Content-Type', 'application/json');
  res.sendFile(absPath);
}

// ─── Shared: safe bundle view (no internal paths) ─────────────────────────────

function _safeBundleView(bundle) {
  return {
    bundleId:         bundle._id,
    onChainStatus:    bundle.onChainStatus,
    evidenceHash:     bundle.evidenceHash,
    summaryHash:      bundle.summaryHash,
    storageBackend:   bundle.storageBackend,
    uploadedAt:       bundle.uploadedAt,
    processedAt:      bundle.processedAt,
    anchoredAt:       bundle.anchoredAt    || null,
    approvedAt:       bundle.approvedAt    || null,
    rejectedAt:       bundle.rejectedAt    || null,
    releasedAt:       bundle.releasedAt    || null,
    rejectionReason:  bundle.rejectionReason || null,
    title:            bundle.title,
    description:      bundle.description,
    fileCount:        bundle.evidenceFiles.length,
    submitTxHash:     bundle.submitTxHash  || null,
    approveTxHash:    bundle.approveTxHash || null,
    rejectTxHash:     bundle.rejectTxHash  || null,
    releaseTxHash:    bundle.releaseTxHash || null,
    explorerUrl:      bundle.submitTxHash
                        ? CHAIN_CONFIG.explorerTxUrl(bundle.submitTxHash) : null,
    files: bundle.evidenceFiles.map((f, i) => ({
      index:        i,
      originalName: f.originalName,
      category:     f.category,
      mimeType:     f.mimeType,
      sizeBytes:    f.sizeBytes,
      fileHash:     f.fileHash,
      serveUrl:     `/api/v1/evidence/files/${bundle._id}/${i}`,
    })),
    summaryUrl: `/api/v1/evidence/files/${bundle._id}/summary`,
  };
}

module.exports = {
  uploadEvidence,
  listBundles,
  getLatestBundle,
  triggerAnchor,
  approveEvidence,
  rejectEvidence,
  releaseMilestoneFunds,
  serveFile,
  serveSummary,
};
