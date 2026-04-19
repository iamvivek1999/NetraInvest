/**
 * src/layouts/AdminLayout.jsx
 *
 * Dedicated layout for the Admin portal with a sidebar navigation.
 */

import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';

export default function AdminLayout() {
  const { logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login/admin');
  };

  const navLinkStyle = ({ isActive }) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.85rem 1.2rem',
    borderRadius: '10px',
    color: isActive ? '#fff' : 'rgba(255,255,255,0.5)',
    background: isActive ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
    border: '1px solid',
    borderColor: isActive ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
    textDecoration: 'none',
    fontWeight: isActive ? 600 : 500,
    transition: 'all 0.2s',
  });

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      background: '#040508',
      fontFamily: "'Inter', sans-serif"
    }}>
      
      {/* ── Sidebar ── */}
      <aside style={{
        width: '280px',
        background: '#0a0d14',
        borderRight: '1px solid rgba(255,255,255,0.05)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{ padding: '2rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.5rem' }}>🛡️</span>
            <div>
              <h1 style={{ margin: 0, fontSize: '1rem', color: '#f8fafc', fontWeight: 800 }}>System Admin</h1>
              <span style={{ fontSize: '0.7rem', color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                Restricted Access
              </span>
            </div>
          </div>
        </div>

        <nav style={{ flex: 1, padding: '0 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <NavLink to="/admin/dashboard" style={navLinkStyle}>
            <span>📋</span> Compliance Queue
          </NavLink>
          <NavLink to="/admin/milestones" style={navLinkStyle}>
            <span>💸</span> Milestone Disbursals
          </NavLink>
          <NavLink to="/admin/sync" style={navLinkStyle}>
            <span>🔄</span> Blockchain Sync
          </NavLink>
        </nav>

        <div style={{ padding: '1.5rem' }}>
          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              padding: '0.85rem',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.6)',
              borderRadius: '10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              transition: 'background 0.2s'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            <span>🚪</span> Terminate Session
          </button>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main style={{ flex: 1, padding: '2rem 3rem', overflowY: 'auto' }}>
        <Outlet />
      </main>

    </div>
  );
}
