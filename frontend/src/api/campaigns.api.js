/**
 * src/api/campaigns.api.js
 *
 * Campaign API calls.
 *
 * Endpoints:
 *   POST  /api/v1/campaigns          → create (startup)
 *   GET   /api/v1/campaigns          → list all/discover (any auth)
 *   GET   /api/v1/campaigns/my       → own campaigns (startup)
 *   GET   /api/v1/campaigns/:id      → single campaign (any auth)
 *   PATCH /api/v1/campaigns/:id      → update (startup, own, draft only)
 *
 * Response envelope: { success, message, data: { campaign | campaigns }, meta? }
 * Each function returns unwrapped payload.
 */

import client from './client';

// ─── Create Campaign ──────────────────────────────────────────────────────────
/**
 * @param {object} payload
 *   { title, summary, fundingGoal, currency, minInvestment, maxInvestment,
 *     deadline, milestoneCount, milestonePercentages[], tags[] }
 * @returns {object} created campaign
 */
export const createCampaign = async (payload) => {
  const { data } = await client.post('/campaigns', payload);
  return data.data.campaign;
};

// ─── Get my campaigns ─────────────────────────────────────────────────────────
/**
 * All campaigns owned by the authenticated startup (any status).
 * @returns {object[]}
 */
export const getMyCampaigns = async () => {
  const { data } = await client.get('/campaigns/my');
  return data.data.campaigns;
};

// ─── Get single campaign ──────────────────────────────────────────────────────
export const getCampaign = async (campaignId) => {
  const { data } = await client.get(`/campaigns/${campaignId}`);
  return data.data.campaign;
};

// ─── Activate campaign (on-chain) ─────────────────────────────────────────────
/**
 * POST /api/v1/campaigns/:id/activate
 * Requires: draft status, milestones created, wallet linked.
 * Returns: { campaign, blockchain: { txHash, contractAddress, campaignKey } }
 */
export const activateCampaign = async (campaignId) => {
  const { data } = await client.post(`/campaigns/${campaignId}/activate`);
  return {
    campaign:   data.data.campaign,
    blockchain: data.data.blockchain,
  };
};

// ─── List/discover campaigns ──────────────────────────────────────────────────
/**
 * @param {object} params  { status, currency, search, page, limit, sortBy }
 * @returns {{ campaigns, meta }}
 */
export const listCampaigns = async (params = {}) => {
  const { data } = await client.get('/campaigns', { params });
  return { campaigns: data.data.campaigns, meta: data.meta };
};

// ─── Update campaign ──────────────────────────────────────────────────────────
export const updateCampaign = async (campaignId, updates) => {
  const { data } = await client.patch(`/campaigns/${campaignId}`, updates);
  return data.data.campaign;
};

// ─── Submit campaign for review ────────────────────────────────────────────────
export const submitCampaign = async (campaignId) => {
  const { data } = await client.post(`/campaigns/${campaignId}/submit`);
  return data.data.campaign;
};

// ─── Milestone Operations ─────────────────────────────────────────────────────
export const getMilestones = async (campaignId) => {
  const { data } = await client.get(`/campaigns/${campaignId}/milestones`);
  return data.data.milestones;
};

export const getMilestone = async (campaignId, milestoneId) => {
  const { data } = await client.get(`/campaigns/${campaignId}/milestones/${milestoneId}`);
  return data.data.milestone;
};

export const submitMilestoneProof = async (campaignId, milestoneId, payload) => {
  const { data } = await client.patch(`/campaigns/${campaignId}/milestones/${milestoneId}/submit`, payload);
  return data.data.milestone;
};
