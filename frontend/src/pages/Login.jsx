/**
 * src/pages/Login.jsx
 *
 * "The Returning Member" — dark, minimal, premium.
 * Mood: calm, familiar, secure. Like signing into a private bank.
 *
 * Layout: Left dark info panel | Right clean form panel
 *
 * Routes: /login/:role (investor | startup)
 */

import { useState }                                           from 'react';
import { Link, useNavigate, useLocation, useParams, Navigate } from 'react-router-dom';
import toast                                                   from 'react-hot-toast';
import { loginUser }                                           from '../api/auth.api';
import client                                                  from '../api/client';
import useAuthStore                                            from '../store/authStore';
import { APP_NAME }                                            from '../utils/constants';

const VALID_ROLES = ['investor', 'startup'];

const ROLE_META = {
  investor: {
    emoji: '💼', label: 'Investor',
    color: '#6366f1', glow: 'rgba(99,102,241,0.25)', altColor: '#818cf8',
    quote: 'Track every rupee. Vote on every milestone.',
  },
  startup: {
    emoji: '🚀', label: 'Startup',
    color: '#10b981', glow: 'rgba(16,185,129,0.25)', altColor: '#34d399',
    quote: 'Raise capital transparently. Build trust on-chain.',
  },
};

const ROLE_REDIRECT = {
  investor: '/dashboard',
  startup:  '/dashboard',
  admin:    '/admin/milestones',
};

const TRUST_STATS = [
  { val: '847+',   lbl: 'Startups' },
  { val: '₹23 Cr', lbl: 'Deployed' },
  { val: '12.4K+', lbl: 'Investors' },
];

export default function Login() {
  /* ── hooks (always called, no early return before this block) ── */
  const { role }    = useParams();
  const navigate    = useNavigate();
  const location    = useLocation();
  const { setAuth } = useAuthStore();

  const [form, setForm]       = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  /* ── derived ── */
  const isValid = VALID_ROLES.includes(role);
  const meta    = ROLE_META[role] || ROLE_META.investor;
  const from    = location.state?.from?.pathname || null;
  const altRole = role === 'investor' ? 'startup' : 'investor';
  const altMeta = ROLE_META[altRole];

  /* ── handlers ── */
  const handleChange = (e) =>
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.email || !form.password) { setError('Please fill in all fields.'); return; }
    setLoading(true);
    try {
      const { user, token } = await loginUser({ ...form, role });
      setAuth(user, token);
      
      let nextRoute = from || ROLE_REDIRECT[user.role] || '/dashboard';

      if (user.role === 'investor') {
        try {
          const res = await client.get('/investors/me', { headers: { Authorization: `Bearer ${token}` } });
          const profile = res.data?.data?.profile;
          if (!profile || !profile.riskAppetite) {
            nextRoute = '/setup/investor';
          }
        } catch (err) {
          if (err.response?.status === 404) {
            nextRoute = '/setup/investor';
          }
        }
      }

      if (user.role === 'startup') {
        try {
          const res = await client.get('/startups/me', { headers: { Authorization: `Bearer ${token}` } });
          const profile = res.data?.data?.profile;
          if (!profile) {
            // No profile yet — send to new multi-step onboarding
            nextRoute = '/startup/onboarding';
          } else if (profile.verificationStatus === 'approved' || profile.isVerified) {
            // Fully verified — regular dashboard
            nextRoute = '/dashboard';
          } else if (profile.verificationStatus === 'draft' || profile.verificationStatus === 'rejected' || profile.verificationStatus === 'more_info_required') {
            // Has draft or was rejected — continue onboarding
            nextRoute = '/startup/onboarding';
          } else {
            // pending / in_review — show status page
            nextRoute = '/startup/pending-verification';
          }
        } catch (err) {
          if (err.response?.status === 404) {
            // No profile yet
            nextRoute = '/startup/onboarding';
          }
          // Other errors: fall through to dashboard
        }
      }

      toast.success(`Welcome back, ${user.fullName.split(' ')[0]}! 👋`);
      navigate(nextRoute, { replace: true });
    } catch (err) {
      setError(err?.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  /* ── guard (after all hooks) ── */
  if (!isValid) return <Navigate to="/auth/role?mode=login" replace />;

  /* ─────────────────────────────────────────────────────────────── */

  return (
    <div style={{
      display:    'flex',
      minHeight:  'calc(100vh - 64px)',
      background: '#06080f',
      fontFamily: "'Inter', sans-serif",
    }}>

      {/* ══════════════════════════════════════════════════════
          LEFT PANEL — dark, atmospheric, branding
      ══════════════════════════════════════════════════════ */}
      <div style={{
        flex:           '0 0 44%',
        display:        'flex',
        flexDirection:  'column',
        justifyContent: 'space-between',
        padding:        '3.5rem 3rem',
        background:     `linear-gradient(160deg, #09091e 0%, #06080f 55%, #050c18 100%)`,
        borderRight:    '1px solid rgba(255,255,255,0.06)',
        position:       'relative',
        overflow:       'hidden',
      }}>

        {/* Decorative orb — role colour */}
        <div aria-hidden style={{
          position:     'absolute',
          top:          '-100px',
          left:         '-80px',
          width:        '400px',
          height:       '400px',
          borderRadius: '50%',
          background:   `radial-gradient(circle, ${meta.color}20 0%, transparent 65%)`,
          filter:       'blur(48px)',
          pointerEvents:'none',
        }} />
        <div aria-hidden style={{
          position:     'absolute',
          bottom:       '-80px',
          right:        '-60px',
          width:        '280px',
          height:       '280px',
          borderRadius: '50%',
          background:   'radial-gradient(circle, #6366f115 0%, transparent 70%)',
          filter:       'blur(40px)',
          pointerEvents:'none',
        }} />

        {/* ── Logo ── */}
        <div style={{
          fontSize:      '1.05rem',
          fontWeight:    900,
          letterSpacing: '0.04em',
          background:    'linear-gradient(135deg, #fff 40%, #a78bfa 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor:  'transparent',
        }}>
          ✦ {APP_NAME.split(' ')[0].toUpperCase()}
        </div>

        {/* ── Centre copy ── */}
        <div>
          <div style={{
            fontSize:      '0.68rem',
            fontWeight:    700,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color:         meta.color,
            marginBottom:  '1rem',
          }}>
            Blockchain-Verified Investments
          </div>

          <h1 style={{
            fontSize:      'clamp(1.8rem, 2.8vw, 2.6rem)',
            fontWeight:    800,
            lineHeight:    1.2,
            color:         '#f0f2ff',
            margin:        '0 0 1rem',
            letterSpacing: '-0.03em',
          }}>
            Every rupee.<br />
            Every milestone.<br />
            <span style={{
              background:           `linear-gradient(135deg, ${meta.color} 0%, ${meta.altColor} 100%)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor:  'transparent',
            }}>
              On‑chain.
            </span>
          </h1>

          <p style={{
            color:     'rgba(240,242,255,0.4)',
            fontSize:  '0.875rem',
            lineHeight: 1.75,
            maxWidth:  '320px',
            margin:    '0 0 2rem',
          }}>
            {meta.quote} Netra records every transaction permanently on Polygon.
          </p>

          {/* Stats strip */}
          <div style={{ display: 'flex', gap: '2rem' }}>
            {TRUST_STATS.map((s) => (
              <div key={s.lbl}>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: meta.color, lineHeight: 1 }}>
                  {s.val}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'rgba(240,242,255,0.35)', marginTop: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {s.lbl}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Bottom trust pills ── */}
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          {['⬡ Polygon', '⬡ CertiK', '⬡ KYB Verified', '⬡ SEBI Aligned'].map((b) => (
            <span key={b} style={{
              fontSize:     '0.68rem',
              padding:      '0.28rem 0.65rem',
              background:   'rgba(255,255,255,0.04)',
              border:       '1px solid rgba(255,255,255,0.07)',
              borderRadius: '999px',
              color:        'rgba(240,242,255,0.38)',
              letterSpacing:'0.02em',
            }}>
              {b}
            </span>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          RIGHT PANEL — clean, minimal form
      ══════════════════════════════════════════════════════ */}
      <div style={{
        flex:           1,
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        padding:        '3rem 2rem',
        background:     '#08091a',
      }}>
        <div style={{ width: '100%', maxWidth: '380px' }}>

          {/* Role pill */}
          <div style={{
            display:      'inline-flex',
            alignItems:   'center',
            gap:          '0.4rem',
            padding:      '0.35rem 0.9rem',
            borderRadius: '999px',
            background:   `${meta.color}18`,
            border:       `1px solid ${meta.color}35`,
            fontSize:     '0.78rem',
            fontWeight:   600,
            color:        meta.color,
            marginBottom: '1.5rem',
          }}>
            {meta.emoji} {meta.label} Account
          </div>

          <h2 style={{
            fontSize:     '2rem',
            fontWeight:   800,
            color:        '#f0f2ff',
            lineHeight:   1.15,
            margin:       '0 0 0.4rem',
            letterSpacing:'-0.03em',
          }}>
            Welcome back
          </h2>
          <p style={{
            color:        'rgba(240,242,255,0.38)',
            fontSize:     '0.875rem',
            marginBottom: '2rem',
          }}>
            Log in to continue to your {meta.label} dashboard.
          </p>

          {/* ── Form ── */}
          <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>

            {error && (
              <div role="alert" style={{
                padding:      '0.75rem 1rem',
                background:   'rgba(239,68,68,0.09)',
                border:       '1px solid rgba(239,68,68,0.22)',
                borderRadius: '10px',
                color:        '#f87171',
                fontSize:     '0.84rem',
                lineHeight:   1.5,
              }}>
                {error}
              </div>
            )}

            <div className="form-group">
              <label className="form-label form-label--req" htmlFor="login-email">Email address</label>
              <input
                id="login-email" name="email" type="email"
                className="form-input"
                placeholder="you@example.com"
                value={form.email} onChange={handleChange}
                required autoComplete="email" disabled={loading}
              />
            </div>

            <div className="form-group">
              <label className="form-label form-label--req" htmlFor="login-password">Password</label>
              <input
                id="login-password" name="password" type="password"
                className="form-input"
                placeholder="••••••••"
                value={form.password} onChange={handleChange}
                required autoComplete="current-password" disabled={loading}
              />
            </div>

            <button
              type="submit"
              id="login-submit"
              disabled={loading}
              style={{
                width:          '100%',
                padding:        '13px',
                marginTop:      '0.4rem',
                borderRadius:   '10px',
                border:         'none',
                background:     `linear-gradient(135deg, ${meta.color} 0%, ${meta.altColor} 100%)`,
                color:          '#06080f',
                fontWeight:     700,
                fontSize:       '0.95rem',
                cursor:         loading ? 'not-allowed' : 'pointer',
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                gap:            '0.5rem',
                opacity:        loading ? 0.7 : 1,
                transition:     'all 0.2s ease',
                letterSpacing:  '0.01em',
              }}
              onMouseEnter={(e) => { if (!loading) e.currentTarget.style.opacity = '0.9'; }}
              onMouseLeave={(e) => { if (!loading) e.currentTarget.style.opacity = '1'; }}
            >
              {loading ? (
                <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Logging in…</>
              ) : (
                `Log in as ${meta.label} →`
              )}
            </button>
          </form>

          {/* ── Footer links ── */}
          <div style={{
            marginTop:  '1.75rem',
            paddingTop: '1.5rem',
            borderTop:  '1px solid rgba(255,255,255,0.06)',
            display:    'flex',
            flexDirection:'column',
            gap:        '0.6rem',
          }}>
            <p style={{ fontSize: '0.8rem', color: 'rgba(240,242,255,0.3)', textAlign: 'center' }}>
              Not a {meta.label}?{' '}
              <Link
                to={`/login/${altRole}`}
                style={{ color: altMeta.color, fontWeight: 600 }}
              >
                {altMeta.emoji} {altMeta.label} login →
              </Link>
            </p>
            <p style={{ fontSize: '0.82rem', color: 'rgba(240,242,255,0.3)', textAlign: 'center' }}>
              First time here?{' '}
              <Link to={`/signup/${role}`} style={{ color: meta.color, fontWeight: 600 }}>
                Create an account →
              </Link>
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
