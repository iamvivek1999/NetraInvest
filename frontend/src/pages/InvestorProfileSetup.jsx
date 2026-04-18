import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import client from '../api/client';
import useAuthStore from '../store/authStore';

const SECTORS = ['DeFi', 'Web3', 'AI', 'Fintech', 'SaaS', 'Climate Tech', 'Gaming', 'Healthcare'];

export default function InvestorProfileSetup() {
  const navigate = useNavigate();
  const { user, role } = useAuthStore();
  
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    riskAppetite: 'medium',
    preferredSectors: [],
    minInvestment: '',
    maxInvestment: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  // Only investors can setup investor profile
  if (role !== 'investor') {
    return <Navigate to="/dashboard" replace />;
  }

  const toggleSector = (sec) => {
    setForm(p => ({
      ...p,
      preferredSectors: p.preferredSectors.includes(sec)
        ? p.preferredSectors.filter(s => s !== sec)
        : [...p.preferredSectors, sec]
    }));
  };

  const handleChange = (e) => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.firstName || !form.lastName || !form.phone) {
      setError('Please fill in your basic details.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const payload = {
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone,
        riskAppetite: form.riskAppetite,
        preferredSectors: form.preferredSectors,
        investmentRange: {
          min: Number(form.minInvestment) || 0,
          max: Number(form.maxInvestment) || 0,
        },
        premiumStatus: false, // defaulted to false on sign up
      };

      // Try POST first (create profile)
      await client.post('/investors', payload).catch(async (err) => {
        // If 409 (Already exists), PATCH instead
        if (err.response?.status === 409) {
          await client.patch('/investors/me', payload);
        } else {
          throw err;
        }
      });
      
      toast.success('Profile completed! Welcome to your dashboard.');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to save profile details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight:  'calc(100vh - 64px)',
      background: '#07080f',
      display:    'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding:    '4rem 2rem',
      fontFamily: "'Inter', sans-serif"
    }}>
      <div style={{
        width:        '100%',
        maxWidth:     '560px',
        background:   '#0a0b16',
        borderRadius: '16px',
        padding:      '3.5rem 3rem',
        position:     'relative',
        overflow:     'hidden',
        border:       '1px solid rgba(255,255,255,0.06)',
        boxShadow:    '0 20px 40px rgba(0,0,0,0.4)',
      }}>
        {/* Glow */}
        <div aria-hidden style={{
          position:     'absolute',
          top:          '-100px',
          right:        '-100px',
          width:        '300px',
          height:       '300px',
          borderRadius: '50%',
          background:   'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)',
          filter:       'blur(60px)',
          pointerEvents:'none',
        }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.35rem 0.9rem',
            borderRadius: '999px',
            background: 'rgba(99,102,241,0.1)',
            border: '1px solid rgba(99,102,241,0.2)',
            color: '#818cf8',
            fontSize: '0.78rem',
            fontWeight: 600,
            marginBottom: '1.25rem',
          }}>
            💼 Complete Setup
          </div>

          <h2 style={{
            fontSize: '2rem',
            fontWeight: 800,
            color: '#f0f2ff',
            letterSpacing: '-0.02em',
            margin: '0 0 0.5rem 0',
          }}>
            Investor Profile
          </h2>
          <p style={{
            fontSize: '0.9rem',
            color: 'rgba(240,242,255,0.4)',
            lineHeight: 1.5,
            marginBottom: '2rem',
          }}>
            Help us personalize your investment deal flow by completing these final details.
          </p>

          {error && (
            <div style={{
              padding: '0.75rem 1rem',
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: '8px',
              color: '#f87171',
              fontSize: '0.85rem',
              marginBottom: '1.5rem',
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label form-label--req">First Name</label>
                <input
                  type="text" name="firstName" className="form-input"
                  value={form.firstName} onChange={handleChange} required
                  placeholder="Jane" disabled={loading}
                />
              </div>
              <div className="form-group">
                <label className="form-label form-label--req">Last Name</label>
                <input
                  type="text" name="lastName" className="form-input"
                  value={form.lastName} onChange={handleChange} required
                  placeholder="Smith" disabled={loading}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label form-label--req">Phone Number</label>
              <input
                type="tel" name="phone" className="form-input"
                value={form.phone} onChange={handleChange} required
                placeholder="+91 9876543210" disabled={loading}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Risk Appetite</label>
              <select 
                name="riskAppetite" 
                className="form-input" 
                value={form.riskAppetite} 
                onChange={handleChange}
                disabled={loading}
              >
                <option value="low">Low - Prefer stable/mature stages</option>
                <option value="medium">Medium - Balanced portfolio</option>
                <option value="high">High - High risk, high reward (Pre-seed/Seed)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Preferred Sectors</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.4rem' }}>
                {SECTORS.map((sec) => {
                  const isSel = form.preferredSectors.includes(sec);
                  return (
                    <button
                      type="button"
                      key={sec}
                      onClick={() => toggleSector(sec)}
                      disabled={loading}
                      style={{
                        padding: '0.4rem 0.8rem',
                        fontSize: '0.78rem',
                        borderRadius: '99px',
                        background: isSel ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.03)',
                        border: isSel ? '1px solid #6366f1' : '1px solid rgba(255,255,255,0.08)',
                        color: isSel ? '#818cf8' : 'rgba(240,242,255,0.5)',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      {sec}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Investment Range per Ticket (₹)</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <input
                  type="number" name="minInvestment" className="form-input"
                  value={form.minInvestment} onChange={handleChange}
                  placeholder="Min (e.g. 50000)" disabled={loading}
                />
                <input
                  type="number" name="maxInvestment" className="form-input"
                  value={form.maxInvestment} onChange={handleChange}
                  placeholder="Max (e.g. 500000)" disabled={loading}
                />
              </div>
            </div>

            <div style={{ marginTop: '0.75rem' }}>
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)',
                  color: '#07080f',
                  fontWeight: 800,
                  fontSize: '0.97rem',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1,
                  boxShadow: loading ? 'none' : '0 4px 20px rgba(99,102,241,0.25)',
                }}
              >
                {loading ? 'Saving Profile...' : 'Complete Profile Setup →'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
