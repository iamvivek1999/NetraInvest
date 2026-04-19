/**
 * src/api/client.js
 *
 * Axios instance pre-configured for the Enigma backend.
 *
 * ─── Request interceptor ─────────────────────────────────────────────────────
 * Reads the JWT from localStorage (same key as Zustand's persist middleware)
 * and attaches it as Authorization: Bearer <token>.
 * Does NOT import authStore to avoid circular dependency
 * (authStore → auth.api → client → authStore).
 *
 * ─── Response interceptor ────────────────────────────────────────────────────
 * 401 → clear localStorage auth entry + redirect to /login
 * 503 → toast "Blockchain service unavailable"
 *
 * Usage:
 *   import client from './client';
 *   const { data } = await client.get('/campaigns');
 *   // data is the raw Axios response; extract data.data for the payload.
 */

import axios   from 'axios';
import toast   from 'react-hot-toast';
import { API_URL } from '../utils/constants';

// ─── Helper: read token without importing store ───────────────────────────────

const getStoredToken = () => {
  try {
    const raw = localStorage.getItem('enigma-auth');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.state?.token || null;
  } catch {
    return null;
  }
};

const clearStoredAuth = () => {
  localStorage.removeItem('enigma-auth');
};

// ─── Axios instance ───────────────────────────────────────────────────────────

const client = axios.create({
  baseURL: API_URL,
  timeout: 30_000, // 30 s — tx-related calls may take a few seconds
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': '69420', // Bypass ngrok's HTML warning page for API calls
  },
});

// ─── Request: attach bearer token ────────────────────────────────────────────

client.interceptors.request.use(
  (config) => {
    const token = getStoredToken();
    // Do not override an explicit Authorization (e.g. right after login when persist
    // has not written localStorage yet but the caller passed the token).
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Response: global error handling ─────────────────────────────────────────

client.interceptors.response.use(
  (response) => response,
  (error) => {
    const status  = error.response?.status;
    const message = error.response?.data?.message;

    if (status === 401) {
      clearStoredAuth();
      // Hard redirect — avoids stale React state in Zustand
      window.location.href = '/login';
    }

    if (status === 503) {
      toast.error(message || 'Blockchain service is temporarily unavailable. Try again shortly.');
    }

    // Re-throw so React Query / manual callers can handle it
    return Promise.reject(error);
  }
);

export default client;
