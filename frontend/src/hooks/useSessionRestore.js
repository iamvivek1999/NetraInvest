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
  const token = useAuthStore((s) => s.token);
  const updateUser = useAuthStore((s) => s.updateUser);
  const [isRestoring, setIsRestoring] = useState(!!token);

  useEffect(() => {
    if (!token) {
      setIsRestoring(false);
      return;
    }

    let cancelled = false;
    setIsRestoring(true);

    const restore = async () => {
      try {
        // Pass token explicitly: Zustand-persist may not have written localStorage yet,
        // so the axios interceptor alone would send no Authorization → 401 → logout loop.
        const { user } = await getCurrentUser(token);
        if (!cancelled && user) {
          updateUser(user);
        }
      } catch {
        // 401 → client interceptor clears session + redirects to /login
      } finally {
        if (!cancelled) setIsRestoring(false);
      }
    };

    restore();
    return () => {
      cancelled = true;
    };
  }, [token, updateUser]);

  return { isRestoring };
}
