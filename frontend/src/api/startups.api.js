/**
 * src/api/startups.api.js
 *
 * All startup-profile API calls for the frontend.
 *
 * Backend endpoints:
 *   POST  /api/v1/startups         → create own profile (startup role)
 *   GET   /api/v1/startups/me      → fetch own profile  (startup role)
 *   PATCH /api/v1/startups/:id     → update own profile (startup role, uses profile _id)
 *   GET   /api/v1/startups/:id     → public profile     (any auth user)
 *   GET   /api/v1/startups         → list/discover      (any auth user)
 *
 * Response envelope:  { success, message, data: { profile | profiles }, meta? }
 * Each function returns the unwrapped payload directly.
 */

import client from './client';

// ─── Get own profile ─────────────────────────────────────────────────────────
/**
 * Fetch the currently authenticated startup's own profile.
 * Returns null (instead of throwing) when a 404 comes back,
 * so callers can distinguish "no profile yet" from real errors.
 * @returns {object|null}
 */
export const getMyStartupProfile = async () => {
  try {
    const { data } = await client.get('/startups/me');
    return data.data.profile;
  } catch (err) {
    if (err?.response?.status === 404) return null; // profile doesn't exist yet
    throw err;
  }
};

// ─── Create profile ───────────────────────────────────────────────────────────
/**
 * Create a new startup profile.
 * @param {object} profileData  All writable fields from StartupProfile schema
 * @returns {object}  Created profile
 */
export const createStartupProfile = async (profileData) => {
  const { data } = await client.post('/startups', profileData);
  return data.data.profile;
};

// ─── Update profile ───────────────────────────────────────────────────────────
/**
 * Partial update on an existing profile.
 * @param {string} profileId  The profile's MongoDB _id
 * @param {object} updates    Only the fields that changed
 * @returns {object}  Updated profile
 */
export const updateStartupProfile = async (profileId, updates) => {
  const { data } = await client.patch(`/startups/${profileId}`, updates);
  return data.data.profile;
};

// ─── Get public profile ───────────────────────────────────────────────────────
/**
 * Fetch any startup profile by its _id (public view for investors).
 * @param {string} profileId
 * @returns {object}
 */
export const getStartupProfile = async (profileId) => {
  const { data } = await client.get(`/startups/${profileId}`);
  return data.data.profile;
};

// ─── Submit profile for verification ─────────────────────────────────────────
/**
 * Transition the startup's own profile from draft → pending.
 * Backend validates required fields before accepting submission.
 * @returns {object} Updated profile
 */
export const submitStartupProfile = async () => {
  const { data } = await client.post('/startups/submit');
  return data.data.profile;
};

// ─── Save draft (alias for create/patch depending on context) ─────────────────
/**
 * Convenience wrapper — always PATCHes if profileId exists, else POSTs.
 * Returns updated/created profile.
 */
export const saveStartupDraft = async (profileId, payload) => {
  if (profileId) {
    return updateStartupProfile(profileId, payload);
  }
  return createStartupProfile(payload);
};

// ─── List all profiles ────────────────────────────────────────────────────────
/**
 * Fetch filtered/paginated list of startup profiles.
 * @param {object} params  { industry, fundingStage, search, page, limit, sortBy }
 * @returns {{ profiles: object[], meta: object }}
 */
export const listStartupProfiles = async (params = {}) => {
  const { data } = await client.get('/startups', { params });
  return {
    profiles: data.data.profiles,
    meta: data.meta,
  };
};

// ─── Get Verification Status ──────────────────────────────────────────────────
/**
 * Get the startup's current verification status and access state.
 * @returns {object} { startupProfileExists, verificationStatus, rejectionReason, canCreateCampaign, nextAction }
 */
export const getVerificationStatus = async () => {
  const { data } = await client.get('/startups/verification-status');
  return data.data;
};

