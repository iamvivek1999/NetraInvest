/**
 * src/api/investments.api.js
 *
 * Investment API — POST /api/v1/investments
 *
 * Called AFTER the on-chain invest() tx has been confirmed.
 * Backend endpoint: POST /api/v1/investments
 * Role: investor only (JWT required)
 *
 * Request body:
 *   campaignId    {string}  — MongoDB ObjectId
 *   txHash        {string}  — 0x + 64 hex (from tx.wait().hash)
 *   walletAddress {string}  — investor's 0x address (lowercase)
 *   amount        {number}  — INR amount (human-readable, e.g. 0.5)
 *   currency      {string}  — 'INR' (default, or 'ETH')
 *
 * In stub mode (VITE_STUB_MODE=true):
 *   txHash is omitted (backend handles stub path)
 *
 * Response envelope: { success, message, data: { investment, verification } }
 */

import client from './client';

/**
 * Record an on-chain investment in the backend database.
 *
 * @param {{
 *   campaignId:    string,
 *   txHash:        string | null,
 *   walletAddress: string,
 *   amount:        number,
 *   currency?:     string,
 * }} payload
 * @returns {{ investment: object, verification: object }}
 */
export const recordInvestment = async (payload) => {
  const { data } = await client.post('/investments', payload);
  return {
    investment:   data.data.investment,
    verification: data.data.verification,
  };
};

/**
 * Fetch the authenticated investor's own investment history.
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
