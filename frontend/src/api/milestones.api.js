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

// ─── Milestone Evidence & Lifecycle Actions ───────────────────────────────────

/**
 * Fetch the overview of all evidence for all milestones of a campaign.
 */
export const getCampaignEvidenceStatus = async (campaignId) => {
  const { data } = await client.get(`/campaigns/${campaignId}/milestones/evidence-status`);
  return data.data;
};

/**
 * Startup uploads proof for a milestone.
 */
export const uploadEvidence = async (campaignId, milestoneIndex, files) => {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));

  const { data } = await client.post(
    `/campaigns/${campaignId}/milestones/${milestoneIndex}/evidence/upload`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  );
  return data.data;
};

/**
 * Admin approves a milestone evidence.
 */
export const approveMilestone = async (campaignId, milestoneIndex) => {
  const { data } = await client.post(
    `/campaigns/${campaignId}/milestones/${milestoneIndex}/evidence/approve`
  );
  return data.data;
};

/**
 * Admin rejects a milestone evidence.
 */
export const rejectMilestone = async (campaignId, milestoneIndex, rejectionReason) => {
  const { data } = await client.post(
    `/campaigns/${campaignId}/milestones/${milestoneIndex}/evidence/reject`,
    { reason: rejectionReason }
  );
  return data.data;
};

/**
 * Admin releases funds for a milestone.
 */
export const markDisbursed = async (campaignId, milestoneIndex) => {
  // Now triggers the on-chain release transaction
  const { data } = await client.post(
    `/campaigns/${campaignId}/milestones/${milestoneIndex}/evidence/release`
  );
  return data.data;
};

/**
 * Fetch the AI summary JSON for a bundle.
 */
export const getEvidenceSummary = async (bundleId) => {
  const { data } = await client.get(`/evidence/files/${bundleId}/summary`);
  return data; // Returns raw JSON directly or standard wrapper depending on backend
};
