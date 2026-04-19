/**
 * src/api/auth.api.js
 *
 * All auth-related API calls. Each function returns the resolved data
 * payload directly (not the raw Axios response) so callers don't need
 * to unwrap response.data every time.
 *
 * Backend response envelope:
 *   { success: true, message: "...", token: "<jwt>", data: { user: {...} } }
 *
 * Endpoints used:
 *   POST  /api/v1/auth/register   → create investor or startup account
 *   POST  /api/v1/auth/login      → authenticate, get JWT
 *   GET   /api/v1/auth/me         → restore session from stored token
 *   PATCH /api/v1/auth/wallet     → link MetaMask wallet address
 */

import client from './client';

// ─── Register ────────────────────────────────────────────────────────────────

/**
 * Create a new account.
 * @param {{ fullName: string, email: string, password: string, role: 'investor'|'startup' }} body
 * @returns {{ user: object, token: string }}
 */
export const registerUser = async ({ fullName, email, password, role }) => {
  const { data } = await client.post('/auth/register', {
    fullName,
    email,
    password,
    role,
  });
  const user = data?.data?.user;
  const token = data?.token;
  if (!user || !token) {
    throw new Error('Invalid registration response from server. Check API URL and backend logs.');
  }
  return { user, token };
};

// ─── Login ───────────────────────────────────────────────────────────────────

/**
 * Authenticate with email + password + role.
 * @param {{ email: string, password: string, role: 'investor'|'startup' }} body
 * @returns {{ user: object, token: string }}
 */
export const loginUser = async ({ email, password, role }) => {
  const { data } = await client.post('/auth/login', { email, password, role });
  const user = data?.data?.user;
  const token = data?.token;
  if (!user || !token) {
    throw new Error('Invalid login response from server. Check API URL and backend logs.');
  }
  return { user, token };
};

// ─── Get current user ────────────────────────────────────────────────────────

/**
 * Fetch the authenticated user from the server using the stored JWT.
 * Used on app mount to validate a persisted session.
 *
 * @param {string} [explicitToken] — pass the token from Zustand when localStorage
 *   may not be flushed yet (persist middleware), so the axios interceptor can authorize.
 * @returns {{ user: object }}
 */
export const getCurrentUser = async (explicitToken) => {
  const config =
    explicitToken != null && explicitToken !== ''
      ? { headers: { Authorization: `Bearer ${explicitToken}` } }
      : {};
  const { data } = await client.get('/auth/me', config);
  return { user: data.data.user };
};

// ─── Link wallet ─────────────────────────────────────────────────────────────

/**
 * Link a MetaMask wallet address to the authenticated user's account.
 * @param {string} walletAddress  — lowercase Ethereum address
 * @returns {{ user: object }}
 */
export const linkWalletAddress = async (walletAddress) => {
  const { data } = await client.patch('/auth/wallet', { walletAddress });
  return { user: data.data.user };
};
