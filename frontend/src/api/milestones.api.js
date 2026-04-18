/**
 * src/api/milestones.api.js
 *
 * Milestone API calls.
 *
 * Endpoints relevant to campaign creation:
 *   POST  /api/v1/campaigns/:campaignId/milestones  → batch create (startup, own, one-time)
 *   GET   /api/v1/campaigns/:campaignId/milestones  → list for campaign (any auth)
 *
 * The full lifecycle (submit, approve, reject, disburse) will be added
 * in the admin / milestone management phase.
 *
 * createMilestones payload:
 *   { milestones: [{ title, description, targetDate? }] }
 *   Array length must equal campaign.milestoneCount exactly.
 *   Percentages come from campaign.milestonePercentages — not sent here.
 */

import client from './client';

// ─── Batch create milestones ──────────────────────────────────────────────────
/**
 * One-time call. Server validates count === campaign.milestoneCount.
 * @param {string} campaignId
 * @param {Array<{ title: string, description: string, targetDate?: string }>} milestones
 * @returns {object[]}  created milestone documents
 */
export const createMilestones = async (campaignId, milestones) => {
  const { data } = await client.post(
    `/campaigns/${campaignId}/milestones`,
    { milestones }
  );
  return data.data.milestones;
};

// ─── Get milestones for a campaign ───────────────────────────────────────────
/**
 * @param {string} campaignId
 * @returns {object[]}  milestones ordered by index
 */
export const getMilestones = async (campaignId) => {
  const { data } = await client.get(`/campaigns/${campaignId}/milestones`);
  return data.data.milestones;
};

// ─── Milestone Lifecycle Actions ─────────────────────────────────────────────

/**
 * Startup submits proof for a milestone.
 */
export const submitProof = async (campaignId, milestoneId, payload) => {
  const { data } = await client.patch(
    `/campaigns/${campaignId}/milestones/${milestoneId}/submit`,
    payload
  );
  return data.data.milestone;
};

/**
 * Admin approves a milestone submission.
 */
export const approveMilestone = async (campaignId, milestoneId) => {
  const { data } = await client.patch(
    `/campaigns/${campaignId}/milestones/${milestoneId}/approve`
  );
  return data.data.milestone;
};

/**
 * Admin rejects a milestone submission.
 */
export const rejectMilestone = async (campaignId, milestoneId, rejectionReason) => {
  const { data } = await client.patch(
    `/campaigns/${campaignId}/milestones/${milestoneId}/reject`,
    { rejectionReason }
  );
  return data.data.milestone;
};

/**
 * Admin strictly records disbursals mapping payments made via 3rd party tooling or wire explicitly.
 */
export const markDisbursed = async (campaignId, milestoneId, disbursalData = {}) => {
  const { data } = await client.patch(
    `/campaigns/${campaignId}/milestones/${milestoneId}/disburse`,
    disbursalData
  );
  return { milestone: data.data.milestone };
};
