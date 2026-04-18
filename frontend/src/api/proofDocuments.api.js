/**
 * src/api/proofDocuments.api.js
 *
 * Proof Document API calls.
 *
 * Endpoints:
 *   GET  /api/v1/milestones/:milestoneId/proof-summary
 *     → Returns lightweight card data (no fileUrl).
 *     → shape: { count, documents: [{ _id, fileName, fileType, order, premiumRequired, summary, summaryGeneratedAt }] }
 *
 *   GET  /api/v1/milestones/:milestoneId/proof-documents
 *     → Returns full documents with fileUrl subject to premium gating.
 *     → shape: { count, visibleCount, lockedCount, isPremium, documents: [...] }
 *     → locked docs: { fileUrl: null, locked: true }
 *
 *   POST /api/v1/milestones/:milestoneId/proof-documents
 *     → Startup uploads a new proof document reference.
 *     → Body: { fileName, fileType, fileUrl, fileSizeBytes?, premiumRequired?, order? }
 *
 *   PATCH /api/v1/milestones/:milestoneId/proof-documents/:documentId/summary
 *     → Admin / AI agent sets the AI-generated summary for a document.
 *     → Body: { summary }
 */

import client from './client';

// ─── Get Proof Summary (lightweight, no fileUrl) ──────────────────────────────
/**
 * Fetches lightweight proof document metadata for a milestone.
 * No fileUrl is returned — safe to display in public campaign views.
 *
 * @param {string} milestoneId
 * @returns {{ count: number, documents: object[] }}
 */
export const getProofSummary = async (milestoneId) => {
  const { data } = await client.get(`/milestones/${milestoneId}/proof-summary`);
  return data.data; // { count, documents }
};

// ─── Get Proof Documents (full, with premium gating) ─────────────────────────
/**
 * Fetches full proof document data for a milestone.
 * For locked docs, `fileUrl` is null and `locked` is true.
 *
 * @param {string} milestoneId
 * @returns {{ count: number, visibleCount: number, lockedCount: number, isPremium: boolean, documents: object[] }}
 */
export const getProofDocuments = async (milestoneId) => {
  const { data } = await client.get(`/milestones/${milestoneId}/proof-documents`);
  return data.data; // { count, visibleCount, lockedCount, isPremium, documents }
};

// ─── Add Proof Document ───────────────────────────────────────────────────────
/**
 * Startup adds a proof document reference to a milestone.
 *
 * @param {string} milestoneId
 * @param {{ fileName: string, fileType: string, fileUrl: string, fileSizeBytes?: number, premiumRequired?: boolean, order?: number }} payload
 * @returns {object} created document
 */
export const addProofDocument = async (milestoneId, payload) => {
  const { data } = await client.post(
    `/milestones/${milestoneId}/proof-documents`,
    payload
  );
  return data.data.document;
};

// ─── Update AI Summary ────────────────────────────────────────────────────────
/**
 * Admin / AI agent updates the AI-generated summary for a specific document.
 *
 * @param {string} milestoneId
 * @param {string} documentId
 * @param {string} summary
 * @returns {object} updated document
 */
export const updateProofSummary = async (milestoneId, documentId, summary) => {
  const { data } = await client.patch(
    `/milestones/${milestoneId}/proof-documents/${documentId}/summary`,
    { summary }
  );
  return data.data.document;
};
