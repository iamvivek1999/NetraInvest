/**
 * src/api/investments.api.js
 *
 * Investment API — POST /api/v1/investments
 *
 * Web3-first (Phase 2). Called AFTER the frontend has:
 *   1. Called contract.invest(campaignKey, { value })
 *   2. Called tx.wait(1) and received a confirmed receipt
 *
 * The backend independently verifies the txHash and InvestmentReceived event
 * before persisting. Amount is taken from the on-chain event, NOT from the
 * client's claimed amount.
 *
 * syncInvestment() is idempotent — safe to retry on failure.
 * A duplicate txHash returns HTTP 200 with the existing record, not a 409 error.
 */

import client from './client';

/**
 * syncInvestment — submit a confirmed on-chain txHash for backend verification.
 *
 * Called from useInvestFlow after tx.wait(1) resolves.
 * Safe to retry: returns existing record on duplicate txHash (idempotent).
 *
 * @param {{
 *   campaignId:    string,   — MongoDB ObjectId
 *   txHash:        string,   — 0x + 64 hex (from tx.wait().hash, lowercase)
 *   walletAddress: string,   — investor wallet (0x + 40 hex, lowercase)
 *   amount:        number,   — POL decimal (e.g. 0.5) — informational only;
 *                              backend uses chain event amount as source of truth
 *   currency?:     string,   — 'POL' (default)
 * }} payload
 * @returns {{ investment: object, verification: object }}
 */
export const syncInvestment = async (payload) => {
  const { data } = await client.post('/investments', {
    campaignId:    payload.campaignId,
    txHash:        payload.txHash?.toLowerCase(),
    walletAddress: payload.walletAddress?.toLowerCase(),
    amount:        payload.amount,
    currency:      payload.currency || 'POL',
  });

  // HTTP 200 = idempotent (already recorded) | HTTP 201 = freshly created
  // Both are success — the backend never returns 409 on duplicate txHash.
  return {
    investment:   data.data.investment,
    verification: data.data.verification,
  };
};

/**
 * recordInvestment — legacy alias kept for backward compatibility.
 * Internally calls syncInvestment.
 *
 * @deprecated Use syncInvestment() for new code.
 */
export const recordInvestment = syncInvestment;

/**
 * getMyInvestments — fetch the authenticated investor's investment history.
 *
 * @param {{ status?: string, page?: number, limit?: number }} params
 * @returns {{ investments: object[], meta: object }}
 */
export const getMyInvestments = async (params = {}) => {
  const { data } = await client.get('/investments/my', { params });
  return {
    investments: data.data.investments,
    meta:        data.meta,
  };
};

/**
 * getStartupInvestments — fetch all investments for the startup's own campaigns.
 *
 * @param {{ page?: number, limit?: number }} params
 * @returns {{ investments: object[], summary: object, meta: object }}
 */
export const getStartupInvestments = async (params = {}) => {
  const { data } = await client.get('/investments/startup', { params });
  return {
    investments: data.data.investments,
    summary:     data.data.summary,
    meta:        data.meta,
  };
};

/**
 * getCampaignInvestments — fetch investments for a campaign (startup/admin only).
 *
 * @param {string} campaignId
 * @param {{ page?: number, limit?: number }} params
 * @returns {{ investments: object[], summary: object, meta: object }}
 */
export const getCampaignInvestments = async (campaignId, params = {}) => {
  const { data } = await client.get(`/investments/campaign/${campaignId}`, { params });
  return {
    investments: data.data.investments,
    summary:     data.data.summary,
    meta:        data.meta,
  };
};
