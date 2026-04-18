/**
 * src/pages/admin/AdminLogin.jsx
 *
 * Hidden portal for System Administrators.
 * Aesthetic: Institutional, highly secure, minimal.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { loginUser } from '../../api/auth.api';
import useAuthStore from '../../store/authStore';

export default function AdminLogin() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) =>
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.email || !form.password) { 
      setError('Please provide administrative credentials.'); 
      return; 
    }
    setLoading(true);
    try {
      // Must explicitly declare role as admin
      const { user, token } = await loginUser({ ...form, role: 'admin' });
      setAuth(user, token);
      toast.success(`Admin session initiated.`);
      navigate('/admin/dashboard', { replace: true });
    } catch (err) {
      setError(err?.response?.data?.message || 'Access denied. Invalid credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      background: '#040508',
      fontFamily: "'Inter', sans-serif",
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '420px',
        padding: '3rem 2.5rem',
        background: '#0a0d14',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: '16px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
        textAlign: 'center'
      }}>
        
        {/* Lock Icon */}
        <div style={{
          width: '50px',
          height: '50px',
          borderRadius: '12px',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.5rem',
          margin: '0 auto 1.5rem',
          color: '#ef4444'
        }}>
          🛡️
        </div>

        <h1 style={{
          fontSize: '1.5rem',
          fontWeight: 800,
          color: '#f8fafc',
          letterSpacing: '-0.02em',
          marginBottom: '0.4rem'
        }}>
          System Administration
        </h1>
        <p style={{
          color: 'rgba(248,250,252,0.4)',
          fontSize: '0.9rem',
          marginBottom: '2rem'
        }}>
          Restricted access portal.
        </p>

        <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'left' }}>
          
          {error && (
            <div style={{
              padding: '0.75rem',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: '8px',
              color: '#fca5a5',
              fontSize: '0.85rem'
            }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label htmlFor="email" style={{ fontSize: '0.8rem', fontWeight: 600, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.02em' }}>
              ADMINISTRATOR IDENTIFIER
            </label>
            <input
              id="email" name="email" type="email"
              style={{
                padding: '0.85rem 1rem',
                background: '#040508',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '0.95rem',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              placeholder="admin@enigmainvest.dev"
              value={form.email} onChange={handleChange}
              disabled={loading}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label htmlFor="password" style={{ fontSize: '0.8rem', fontWeight: 600, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.02em' }}>
              SECURITY CREDENTIAL
            </label>
            <input
              id="password" name="password" type="password"
              style={{
                padding: '0.85rem 1rem',
                background: '#040508',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '0.95rem',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              placeholder="••••••••••"
              value={form.password} onChange={handleChange}
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: '1rem',
              padding: '0.9rem',
              background: '#ef4444',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 700,
              cursor: loading ? 'wait' : 'pointer',
              opacity: loading ? 0.7 : 1,
              transition: 'background 0.2s'
            }}
          >
            {loading ? 'AUTHENTICATING...' : 'AUTHORIZE SESSION'}
          </button>
        </form>
      </div>
    </div>
  );
}
