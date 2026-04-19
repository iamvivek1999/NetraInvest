/**
 * GET /api/v1/campaigns/:campaignId/milestones/evidence-status
 *
 * Returns all milestone evidence states for a campaign in one call.
 * Designed for dashboard widgets — investors, startup, and admin.
 *
 * Response shape:
 * {
 *   campaignId,
 *   campaignKey,
 *   milestones: [
 *     {
 *       milestoneIndex: 0,
 *       onChainStatus: 'anchored' | 'approved' | ... | null,
 *       evidenceHash,
 *       summaryHash,
 *       submitTxHash,
 *       approveTxHash,
 *       rejectTxHash,
 *       releaseTxHash,
 *       anchoredAt,
 *       approvedAt,
 *       rejectedAt,
 *       releasedAt,
 *       rejectionReason,
 *       explorerUrl,
 *       fileCount,
 *       uploadedAt,
 *       stateLabel,           ← human-readable label for UI badge
 *       stateColor,           ← CSS hint: 'gray'|'blue'|'yellow'|'green'|'red'|'purple'
 *     }
 *   ]
 * }
 */

'use strict';

const Campaign = require('../models/Campaign');
const Milestone = require('../models/Milestone');
const EvidenceBundle = require('../models/EvidenceBundle');
const sendResponse = require('../utils/sendResponse');
const { CHAIN_CONFIG } = require('../config/blockchain');

// ─── Status label/color map ───────────────────────────────────────────────────

const STATE_MAP = {
  // reviewStatus mappings
  pending:      { label: 'Waiting for submission', color: 'gray' },
  submitted:    { label: 'Submitted — Awaiting Review', color: 'blue' },
  under_review: { label: 'Under AI/Admin Review', color: 'yellow' },
  approved:     { label: 'Approved — Ready for Release', color: 'green' },
  rejected:     { label: 'Rejected — Needs Resubmission', color: 'red' },
  
  // onChainStatus overrides (if released)
  released:     { label: 'Funds Released ✓', color: 'purple' },
};

// ─── Controller ───────────────────────────────────────────────────────────────

async function getCampaignEvidenceStatus(req, res) {
  const { campaignId } = req.params;

  const campaign = await Campaign.findById(campaignId).select('campaignKey userId');
  if (!campaign) return sendResponse(res, 404, false, 'Campaign not found');

  // Ownership gate
  if (req.user.role !== 'admin' &&
    req.user.role !== 'investor' &&
    !campaign.userId.equals(req.user._id)) {
    return sendResponse(res, 403, false, 'Access denied');
  }

  // Fetch all milestones for this campaign
  const milestonesData = await Milestone.find({ campaignId: campaign._id })
    .sort({ milestoneIndex: 1 })
    .lean();

  // Fetch latest bundles for enrichment
  const allBundles = await EvidenceBundle
    .find({ campaignId: campaign._id })
    .sort({ milestoneIndex: 1, createdAt: -1 })
    .lean();

  const latestBundleByIndex = {};
  for (const b of allBundles) {
    if (!latestBundleByIndex[b.milestoneIndex]) latestBundleByIndex[b.milestoneIndex] = b;
  }

  const milestones = milestonesData.map(ms => {
    const bundle = latestBundleByIndex[ms.milestoneIndex] || null;
    
    // Determine UI state
    let stateInfo;
    if (ms.onChainStatus === 'released') {
      stateInfo = STATE_MAP.released;
    } else {
      stateInfo = STATE_MAP[ms.reviewStatus] || STATE_MAP.pending;
    }

    return {
      milestoneIndex: ms.milestoneIndex,
      reviewStatus: ms.reviewStatus,
      onChainStatus: ms.onChainStatus,
      stateLabel: stateInfo.label,
      stateColor: stateInfo.color,
      
      // Evidence detail
      evidenceHash: ms.evidenceHash || null,
      summaryHash: ms.summaryHash || null,
      submitTxHash: bundle?.submitTxHash || ms.evidenceAnchorTxHash || null,
      releaseTxHash: ms.releaseTxHash || null,
      
      anchoredAt: bundle?.anchoredAt || null,
      approvedAt: ms.approvedAt || null,
      rejectedAt: ms.rejectedAt || null,
      releasedAt: ms.releasedAt || null,
      
      rejectionReason: ms.rejectionReason || null,
      fileCount: bundle ? (bundle.evidenceFiles?.length || 0) : 0,
      uploadedAt: bundle?.uploadedAt || null,
      bundleId: bundle?._id || null,
      explorerUrl: (bundle?.submitTxHash || ms.evidenceAnchorTxHash)
        ? CHAIN_CONFIG.explorerTxUrl(bundle?.submitTxHash || ms.evidenceAnchorTxHash)
        : null,
    };
  });

  return sendResponse(res, 200, true, 'Campaign evidence status', {
    campaignId,
    campaignKey: campaign.campaignKey,
    milestones,
  });
}

module.exports = { getCampaignEvidenceStatus };
