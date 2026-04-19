/**
 * src/layouts/Navbar.jsx
 * Fixed top navigation bar.
 *
 * Auth states:
 *   Logged out → "Log in" (ghost) + "Get started" (primary)
 *   Logged in  → role badge + wallet address pill (if linked) + Dashboard link + Log out
 *
 * Logout flow:
 *   1. authStore.logout() clears Zustand state + localStorage (via persist middleware)
 *   2. React Query cache is NOT cleared here — stale data won't be shown
 *      because all protected routes redirect to /login immediately
 *   3. navigate('/') sends user to landing page
 */

import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useQueryClient }              from '@tanstack/react-query';
import toast                           from 'react-hot-toast';
import useAuthStore                    from '../store/authStore';
import { shortenAddress }              from '../utils/formatters';
import { APP_NAME }                    from '../utils/constants';
import NotificationBell               from '../components/NotificationBell';
import WalletStatus                   from '../components/WalletStatus';

export default function Navbar() {
  const { isLoggedIn, user, role, logout } = useAuthStore();
  const navigate      = useNavigate();
  const queryClient   = useQueryClient();

  const handleLogout = () => {
    logout();
    // Clear all cached API data so the next user starts fresh
    queryClient.clear();
    toast.success('Logged out successfully.');
    navigate('/', { replace: true });
  };

  return (
    <nav className="navbar">
      <div className="navbar__inner">

        {/* ── Logo ────────────────────────────────────────────────────── */}
        <Link to="/" className="navbar__logo">
          ✦ {APP_NAME.split(' ')[0].toUpperCase()}
        </Link>

        {/* ── Centre nav links ─────────────────────────────────────────── */}
        <div className="navbar__links">
          <NavLink
            to="/discover"
            className={({ isActive }) =>
              'navbar__link' + (isActive ? ' navbar__link--active' : '')
            }
          >
            🚀 Discover
          </NavLink>
        </div>

        {/* ── Right: auth controls ─────────────────────────────────────── */}
        <div className="navbar__actions">
          {isLoggedIn ? (
            <>
              {/* Wallet Status (Web3 Account & Balance) */}
              <WalletStatus />

              {/* Role badge */}
              <span className={`badge badge--${role}`}>{role}</span>

              {/* User name pill */}
              <span className="user-pill">
                👤 {user?.fullName?.split(' ')[0] || 'Account'}
              </span>

              {/* Notification bell */}
              <NotificationBell />

              {/* Dashboard link */}
              <NavLink
                to="/dashboard"
                className={({ isActive }) =>
                  'btn btn--ghost btn--sm' + (isActive ? '' : '')
                }
              >
                Dashboard
              </NavLink>

              {/* Logout */}
              <button
                id="navbar-logout"
                onClick={handleLogout}
                className="btn btn--secondary btn--sm"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link to="/auth/role?mode=login"   className="btn btn--ghost btn--sm"   id="navbar-login">
                Log in
              </Link>
              <Link to="/auth/role?mode=signup" className="btn btn--primary btn--sm" id="navbar-register">
                Get started
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
