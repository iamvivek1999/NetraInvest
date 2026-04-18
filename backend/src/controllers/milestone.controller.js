/**
 * src/controllers/milestone.controller.js
 *
 * Milestone lifecycle handlers.
 *
 * ─── State Machine (corrected) ───────────────────────────────────────────────
 *
 *   pending ──► submitted ──► approved ──► disbursed  (terminal)
 *                   │
 *                   └──► rejected ──► submitted  (startup resubmits)
 *
 *
 * Rule: currentMilestoneIndex advances ONLY on disbursal, never on approve.
 *
 *   approve  = off-chain review decision (admin confirms proof is valid)
 *   disburse = financial event (admin resolves fund release offline → next milestone unlocked)
 *
 * These are two separate steps because there is a real gap between
 * them: admin approves → admins process offchain transfer →
 * logs disbursal state → backend marks milestone 'disbursed'.
 *
 * ─── Reject / Resubmit ───────────────────────────────────────────────────────
 *
 *   Admin rejects a 'submitted' milestone with a reason.
 *   Milestone status → 'rejected'. currentMilestoneIndex unchanged.
 *   Startup can see the rejection reason, fix their proof, and call /submit again.
 * Milestone state machine:
 *   pending → submitted → approved → disbursed  (terminal, irreversible)
 *                ↑          ↓
 *             rejected  ←─────── (startup resubmits after rejection)
 *
 * currentMilestoneIndex is the campaign-level pointer to which milestone is next.
 * It advances ONLY at markDisbursed — never at approve.
 *
 * Sequential enforcement: milestone.index must equal campaign.currentMilestoneIndex
 * for submit, approve, and disburse. You cannot skip a milestone.
 *
 * Off-Chain integration:
 *   markDisbursed logs off-chain releases strictly.
 *   approveMilestone remains early preliminary approval purely off-chain.
 */

const Campaign     = require('../models/Campaign');
const Milestone    = require('../models/Milestone');
const Investment   = require('../models/Investment');
const sendResponse = require('../utils/sendResponse');
const { ApiError } = require('../middleware/errorHandler');
const notify       = require('../utils/notify');

// ─── Shared: load campaign + verify ownership ─────────────────────────────────

const loadCampaign = async (campaignId) => {
  const campaign = await Campaign.findById(campaignId);
  if (!campaign) throw new ApiError('Campaign not found.', 404);
  return campaign;
};

const assertOwnership = (campaign, userId) => {
  if (campaign.userId.toString() !== userId) {
    throw new ApiError('You are not authorized to manage milestones for this campaign.', 403);
  }
};

// ─── Create Milestones (Batch) ────────────────────────────────────────────────

/**
 * POST /api/v1/campaigns/:campaignId/milestones
 * Role: startup only, own campaign
 *
 * One-time batch creation.
 * milestones[] in body must have exactly campaign.milestoneCount elements.
 * Percentages are read from campaign.milestonePercentages — not from client.
 * estimatedAmount is computed and stored as a snapshot.
 */
const createMilestones = async (req, res) => {
  const { campaignId } = req.params;
  const { userId }     = req.user;

  const campaign = await loadCampaign(campaignId);
  assertOwnership(campaign, userId);

  // Only allow milestone creation for draft or active campaigns
  if (['completed', 'cancelled'].includes(campaign.status)) {
    throw new ApiError(
      `Cannot create milestones for a ${campaign.status} campaign.`,
      400
    );
  }

  // One-time creation guard
  const existingCount = await Milestone.countDocuments({ campaignId });
  if (existingCount > 0) {
    throw new ApiError(
      'Milestones have already been created for this campaign. ' +
        'Use the individual milestone update endpoints to modify them.',
      409
    );
  }

  const { milestones: milestoneInputs } = req.body;

  // Array length must match campaign.milestoneCount
  if (milestoneInputs.length !== campaign.milestoneCount) {
    throw new ApiError(
      `This campaign requires exactly ${campaign.milestoneCount} milestone(s). ` +
        `You provided ${milestoneInputs.length}.`,
      400
    );
  }

  // Build milestone documents
  const milestoneDocs = milestoneInputs.map((input, i) => ({
    campaignId,
    startupProfileId: campaign.startupProfileId,
    userId,
    index:           i,
    title:           input.title.trim(),
    description:     input.description.trim(),
    targetDate:      input.targetDate ? new Date(input.targetDate) : null,
    // Snapshot from campaign — stored for auditability
    percentage:      campaign.milestonePercentages[i],
    estimatedAmount: parseFloat(
      ((campaign.fundingGoal * campaign.milestonePercentages[i]) / 100).toFixed(6)
    ),
    status: 'pending',
  }));

  const created = await Milestone.insertMany(milestoneDocs, { ordered: true });

  sendResponse(res, 201, `${created.length} milestone(s) created successfully`, {
    milestones: created,
  });
};

// ─── Get Milestones for a Campaign ───────────────────────────────────────────

/**
 * GET /api/v1/campaigns/:campaignId/milestones
 * Role: any authenticated user
 *
 * Returns all milestones for the campaign, ordered by index.
 */
const getMilestones = async (req, res) => {
  const { campaignId } = req.params;

  // Verify campaign exists
  await loadCampaign(campaignId);

  const milestones = await Milestone.find({ campaignId })
    .sort({ index: 1 })
    .populate('approvedBy', 'fullName email');

  sendResponse(res, 200, 'Milestones retrieved', { milestones });
};

// ─── Get Single Milestone ─────────────────────────────────────────────────────

/**
 * GET /api/v1/campaigns/:campaignId/milestones/:milestoneId
 * Role: any authenticated user
 */
const getMilestone = async (req, res) => {
  const { campaignId, milestoneId } = req.params;

  const milestone = await Milestone.findOne({ _id: milestoneId, campaignId })
    .populate('approvedBy', 'fullName email');

  if (!milestone) {
    throw new ApiError('Milestone not found.', 404);
  }

  sendResponse(res, 200, 'Milestone retrieved', { milestone });
};

// ─── Submit Proof ─────────────────────────────────────────────────────────────
// UPDATED FOR OFF-CHAIN MILESTONE DISBURSAL

/**
 * PATCH /api/v1/campaigns/:campaignId/milestones/:milestoneId/submit
 * Role: startup only, own campaign
 *
 * Rules:
 *  - Milestone must be 'pending' or 'rejected' (can resubmit after rejection)
 *  - This milestone's index must be === campaign.currentMilestoneIndex
 *    (enforces sequential processing — can't skip ahead)
 *  - Campaign must be 'active' or 'funded' (not draft/cancelled/completed)
 */
const submitProof = async (req, res) => {
  const { campaignId, milestoneId } = req.params;
  const { userId } = req.user;

  const [campaign, milestone] = await Promise.all([
    loadCampaign(campaignId),
    Milestone.findOne({ _id: milestoneId, campaignId }),
  ]);

  if (!milestone) throw new ApiError('Milestone not found.', 404);

  assertOwnership(campaign, userId);

  // Campaign must be active or funded for proof submission
  if (!['active', 'funded'].includes(campaign.status)) {
    throw new ApiError(
      `Proof can only be submitted for active or funded campaigns. ` +
        `Current campaign status: "${campaign.status}".`,
      400
    );
  }

  // Milestone must be pending or rejected (not submitted/approved/released)
  if (!['pending', 'rejected'].includes(milestone.status)) {
    throw new ApiError(
      `Milestone is currently "${milestone.status}". ` +
        `Proof can only be submitted when status is "pending" or "rejected".`,
      400
    );
  }

  // Sequential check — must be the current active milestone
  if (milestone.index !== campaign.currentMilestoneIndex) {
    throw new ApiError(
      `Milestones must be completed in order. ` +
        `The current active milestone is #${campaign.currentMilestoneIndex + 1} (index ${campaign.currentMilestoneIndex}). ` +
        `This is milestone #${milestone.index + 1} (index ${milestone.index}).`,
      400
    );
  }

  const { description, proofLinks = [], documents = [] } = req.body;

  const updated = await Milestone.findByIdAndUpdate(
    milestoneId,
    {
      $set: {
        status: 'submitted',
        rejectionReason: null, // clear any previous rejection
        rejectedAt:      null,
        proofSubmission: {
          description,
          proofLinks,
          documents,
          submittedAt: new Date(),
        },
      },
    },
    { new: true, runValidators: true }
  );

  sendResponse(res, 200, 'Proof submitted successfully. Awaiting admin review.', {
    milestone: updated,
  });

  // Notify all investors who invested in this campaign about the milestone update (fire-and-forget)
  setImmediate(async () => {
    try {
      const investorIds = await Investment.distinct('investorUserId', {
        campaignId: updated.campaignId,
        status: { $in: ['confirmed', 'unverified'] },
      });
      const msg = `Milestone "${updated.title}" in "${campaign.title}" has been updated.`;
      for (const investorId of investorIds) {
        await notify(investorId, 'milestone_updated', msg, {
          campaignId: updated.campaignId,
          milestoneId: updated._id,
        });
      }
    } catch (e) {
      console.error('[notify] milestone_updated fan-out error:', e.message);
    }
  });
};

// ─── Approve Milestone ────────────────────────────────────────────────────────

/**
 * PATCH /api/v1/campaigns/:campaignId/milestones/:milestoneId/approve
 * Role: admin only
 *
 * Off-chain review step only.
 * Records that admin has verified the startup's proof of work.
 * Does NOT advance currentMilestoneIndex — that only happens on disbursal.
 * Does NOT trigger any fund transfer natively.
 *
 * Phase 2: after this, admin calls /disburse resolving offline checks securely.
 */
const approveMilestone = async (req, res) => {
  const { campaignId, milestoneId } = req.params;
  const { userId } = req.user;

  const [, milestone] = await Promise.all([
    loadCampaign(campaignId),
    Milestone.findOne({ _id: milestoneId, campaignId }),
  ]);

  if (!milestone) throw new ApiError('Milestone not found.', 404);

  if (milestone.status !== 'submitted') {
    throw new ApiError(
      `Only submitted milestones can be approved. Current status: "${milestone.status}".`,
      400
    );
  }

  const updated = await Milestone.findByIdAndUpdate(
    milestoneId,
    {
      $set: {
        status:     'approved',
        approvedBy: userId,
        approvedAt: new Date(),
      },
    },
    { new: true, runValidators: true }
  ).populate('approvedBy', 'fullName email');

  // currentMilestoneIndex is intentionally NOT advanced here.
  // It advances only in markDisbursed, which is the financial event.

  sendResponse(
    res,
    200,
    'Milestone approved. Mark as disbursed after transferring funds off-chain.',
    { milestone: updated }
  );

  // Notify startup their milestone was approved
  notify(
    campaign.userId,
    'milestone_approved',
    `Your milestone "${updated.title}" has been approved. Awaiting fund disbursal.`,
    { campaignId: campaign._id, milestoneId: updated._id }
  );
};

// ─── Mark Milestone Disbursed ──────────────────────────────────────────────────
// UPDATED FOR OFF-CHAIN MILESTONE DISBURSAL

/**
 * PATCH /api/v1/campaigns/:campaignId/milestones/:milestoneId/disburse
 * Role: admin only
 *
 * The financial event strictly offline. This is where currentMilestoneIndex advances.
 *
 *   1. Validates milestone is 'approved'
 *   2. Parses an optional object from the body indicating 'disbursalReference' 'disbursalNote' 
 *   3. Writes 'disbursed' state updating values sequentially.
 *   4. Advances currentMilestoneIndex and marks campaign completed if final.
 */
const markDisbursed = async (req, res) => {
  const { campaignId, milestoneId } = req.params;

  const [campaign, milestone] = await Promise.all([
    loadCampaign(campaignId),
    Milestone.findOne({ _id: milestoneId, campaignId }),
  ]);

  if (!milestone) throw new ApiError('Milestone not found.', 404);

  if (milestone.status !== 'approved') {
    throw new ApiError(
      `Only approved milestones can be marked as disbursed. Current status: "${milestone.status}". ` +
        'Approve the milestone first.',
      400
    );
  }

  const { disbursalReference, disbursalNote } = req.body || {};

  const now = new Date();
  const updated = await Milestone.findByIdAndUpdate(
    milestoneId,
    {
      $set: {
        status:             'disbursed',
        disbursedAt:        now,
        disbursedBy:        req.user.userId,
        disbursalReference: disbursalReference || null,
        disbursalNote:      disbursalNote || null,
        disbursedAmount:    milestone.estimatedAmount, // Since it defaults off estimated logic here
      },
    },
    { new: true, runValidators: true }
  ).populate('approvedBy', 'fullName email').populate('disbursedBy', 'fullName email');

  // Advance currentMilestoneIndex — unlocks next milestone for submission
  const nextIndex      = campaign.currentMilestoneIndex + 1;
  const isFinalMilestone = nextIndex >= campaign.milestoneCount;

  await Campaign.findByIdAndUpdate(campaignId, {
    $inc: { currentMilestoneIndex: 1 },
    ...(isFinalMilestone && { $set: { status: 'completed' } }),
  });

  const message = isFinalMilestone
    ? 'Final milestone marked disbursed. Campaign completed.'
    : `Milestone disbursed. Milestone #${nextIndex + 1} is unlocked.`;

  sendResponse(res, 200, message, {
    milestone: updated,
  });

  // Notify startup their milestone was disbursed
  notify(
    campaign.userId,
    'milestone_disbursed',
    isFinalMilestone
      ? `Final milestone "${updated.title}" disbursed. Campaign "${campaign.title}" is complete!`
      : `Milestone "${updated.title}" funds have been disbursed. Next milestone is now unlocked.`,
    { campaignId: campaign._id, milestoneId: updated._id }
  );
};

// ─── Reject Milestone ─────────────────────────────────────────────────────────

/**
 * PATCH /api/v1/campaigns/:campaignId/milestones/:milestoneId/reject
 * Role: admin only
 *
 * Rejects a submitted milestone proof.
 * Startup can resubmit (status goes back to 'rejected', then → 'submitted').
 * currentMilestoneIndex is NOT incremented.
 */
const rejectMilestone = async (req, res) => {
  const { campaignId, milestoneId } = req.params;

  const milestone = await Milestone.findOne({ _id: milestoneId, campaignId });
  if (!milestone) throw new ApiError('Milestone not found.', 404);

  if (milestone.status !== 'submitted') {
    throw new ApiError(
      `Only submitted milestones can be rejected. Current status: "${milestone.status}".`,
      400
    );
  }

  const { rejectionReason } = req.body;

  const updated = await Milestone.findByIdAndUpdate(
    milestoneId,
    {
      $set: {
        status:          'rejected',
        rejectionReason,
        rejectedAt:      new Date(),
      },
    },
    { new: true, runValidators: true }
  );

  sendResponse(res, 200, 'Milestone rejected. Startup has been notified to resubmit.', {
    milestone: updated,
  });

  // Notify startup their milestone was rejected (load campaign for userId)
  const campaignForReject = await Campaign.findById(campaignId).select('userId title');
  if (campaignForReject) {
    notify(
      campaignForReject.userId,
      'milestone_rejected',
      `Your milestone "${updated.title}" was rejected. Reason: ${rejectionReason ?? 'No reason provided'}. Please resubmit.`,
      { campaignId, milestoneId: updated._id }
    );
  }
};

module.exports = {
  createMilestones,
  getMilestones,
  getMilestone,
  submitProof,
  approveMilestone,
  rejectMilestone,
  markDisbursed,
};
