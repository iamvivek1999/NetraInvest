/**
 * src/pages/dashboard/DashboardRouter.jsx
 *
 * Reads the authenticated user's role and renders the appropriate dashboard.
 * Lives at /dashboard.
 *
 * Sidebar is shared across both roles and adapts its links by role.
 */

import { NavLink, useNavigate, Outlet } from 'react-router-dom';
import useAuthStore             from '../../store/authStore';

// Role-specific sidebar nav links
const INVESTOR_LINKS = [
  { to: '/dashboard',             icon: '🏠', label: 'Overview'         },
  { to: '/dashboard/investments', icon: '💰', label: 'My Investments'   },
  { to: '/discover',              icon: '🔍', label: 'Discover'         },
  { to: '/dashboard/profile',     icon: '👤', label: 'My Profile'       },
];

const STARTUP_LINKS = [
  { to: '/dashboard',               icon: '🏠', label: 'Overview'        },
  { to: '/dashboard/campaigns',     icon: '📋', label: 'My Campaigns'    },
  { to: '/dashboard/campaigns/new', icon: '➕', label: 'New Campaign'    },
  { to: '/dashboard/profile',       icon: '🏢', label: 'Startup Profile' },
  { to: '/dashboard/milestones',    icon: '🏁', label: 'Milestones'      },
  { to: '/dashboard/investors',     icon: '👥', label: 'My Investors'    },
];

const ADMIN_LINKS = [
  { to: '/admin/milestones', icon: '⚙️', label: 'Milestone Review' },
];

function Sidebar({ links, role, user, onLogout }) {
  return (
    <aside className="sidebar">
      {/* User info */}
      <div style={{
        padding:       '0.75rem 0.75rem 1.25rem',
        borderBottom:  '1px solid var(--color-border)',
        marginBottom:  '0.5rem',
      }}>
        <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{user?.fullName}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
          {user?.email}
        </div>
        <div style={{ marginTop: '0.5rem' }}>
          <span className={`badge badge--${role}`}>{role}</span>
        </div>
      </div>

      <span className="sidebar__section-label">Navigation</span>

      {links.map((l) => (
        <NavLink
          key={l.to}
          to={l.to}
          end={l.to === '/dashboard'}
          className={({ isActive }) =>
            'sidebar__link' + (isActive ? ' sidebar__link--active' : '')
          }
        >
          <span className="sidebar__link__icon">{l.icon}</span>
          {l.label}
        </NavLink>
      ))}

      {/* Spacer + logout at bottom */}
      <div style={{ flex: 1 }} />
      <button
        onClick={onLogout}
        className="sidebar__link"
        style={{ marginTop: '1rem', cursor: 'pointer', color: 'var(--color-error)', width: '100%', textAlign: 'left', background: 'none', border: 'none' }}
      >
        <span className="sidebar__link__icon">🚪</span>
        Log out
      </button>
    </aside>
  );
}

export default function DashboardRouter() {
  const { role, user, logout } = useAuthStore();
  const navigate               = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const links =
    role === 'investor' ? INVESTOR_LINKS :
    role === 'startup'  ? STARTUP_LINKS  :
    role === 'admin'    ? ADMIN_LINKS    : [];

  return (
    <div className="dashboard">
      <Sidebar links={links} role={role} user={user} onLogout={handleLogout} />
      <div className="dashboard__content">
        <Outlet />
      </div>
    </div>
  );
}
