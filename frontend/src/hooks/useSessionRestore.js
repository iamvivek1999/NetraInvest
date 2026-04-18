/**
 * src/hooks/useSessionRestore.js
 *
 * Custom hook that validates a persisted JWT session on app startup.
 *
 * Why this is needed:
 *   Zustand's persist middleware restores { user, token } from localStorage
 *   on hydration. However, the stored token could be expired or the user
 *   could have been deactivated server-side. This hook calls GET /auth/me
 *   on mount to verify the token and refresh the user object.
 *
 * Behaviour:
 *   - If token is stored and /me succeeds → update user in store (fresh data)
 *   - If /me returns 401 (expired/invalid) → the Axios interceptor in client.js
 *     will clear localStorage and redirect to /login automatically
 *   - If no token is stored → do nothing (user stays logged out)
 *   - Sets a global `isRestoring` flag during the check to prevent route
 *     guards from flashing a redirect before the check completes
 *
 * Usage:
 *   Call this hook ONCE at the top of App.jsx:
 *     const { isRestoring } = useSessionRestore();
 *     if (isRestoring) return <FullPageSpinner />;
 */

import { useEffect, useState } from 'react';
import useAuthStore            from '../store/authStore';
import { getCurrentUser }      from '../api/auth.api';

export default function useSessionRestore() {
  const { token, updateUser, logout } = useAuthStore();
  const [isRestoring, setIsRestoring] = useState(!!token); // true only if we have a token to verify

  useEffect(() => {
    // No token stored — nothing to restore
    if (!token) {
      setIsRestoring(false);
      return;
    }

    let cancelled = false;

    const restore = async () => {
      try {
        const { user } = await getCurrentUser();
        if (!cancelled) {
          // Refresh user in store with latest server data
          updateUser(user);
        }
      } catch {
        // 401 is handled in client.js interceptor (clears store + redirects)
        // Any other error (network down, 500) → silently keep existing session
        if (!cancelled) {
          // If server responded with anything other than 401, keep the user logged in
          // (network failure shouldn't log people out during offline usage)
        }
      } finally {
        if (!cancelled) setIsRestoring(false);
      }
    };

    restore();
    return () => { cancelled = true; };
  }, []); // Intentionally empty — run only on mount

  return { isRestoring };
}
