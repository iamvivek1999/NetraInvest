/**
 * src/store/authStore.js
 *
 * Zustand auth store with persistence via localStorage.
 * This is the SINGLE source of truth for:
 *   - current user object (id, name, email, role, walletAddress)
 *   - JWT token
 *   - derived role/isLoggedIn flags
 *
 * The persist middleware syncs state to localStorage under the key
 * 'enigma-auth'. The Axios client reads from the same key to attach
 * the Authorization header WITHOUT importing this store (avoids circular deps).
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useAuthStore = create(
  persist(
    (set) => ({
      // ── State ───────────────────────────────────────────────────────────────
      user:      null,   // { _id, fullName, email, role, walletAddress }
      token:     null,   // JWT string
      role:      null,   // 'investor' | 'startup' | 'admin' | null
      isLoggedIn: false,

      // ── Actions ─────────────────────────────────────────────────────────────

      /**
       * Called after successful login or register.
       * @param {object} user  - User object from API response
       * @param {string} token - JWT token from API response
       */
      setAuth: (user, token) =>
        set({
          user,
          token,
          role:      user.role,
          isLoggedIn: true,
        }),

      /**
       * Patch the stored user object (e.g. after linking wallet address).
       * Only provided keys are updated.
       */
      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),

      /**
       * Clear all auth state. Called on logout or 401 response.
       */
      logout: () =>
        set({
          user:      null,
          token:     null,
          role:      null,
          isLoggedIn: false,
        }),
    }),
    {
      name: 'enigma-auth', // localStorage key — must match client.js getToken()
      // Only persist these fields; derived values are recomputed on hydration.
      partialize: (state) => ({
        user:      state.user,
        token:     state.token,
        role:      state.role,
        isLoggedIn: state.isLoggedIn,
      }),
    }
  )
);

export default useAuthStore;
