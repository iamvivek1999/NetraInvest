/**
 * src/pages/Register.jsx
 *
 * "The New Member Journey" — vibrant, energetic, welcoming.
 * Mood: exciting fresh start, "you're about to join something great".
 *
 * Layout: Left clean form panel | Right vibrant benefits panel
 *
 * Routes: /signup/:role (investor | startup)
 */

import { useState }                                           from 'react';
import { Link, useNavigate, useParams, Navigate }             from 'react-router-dom';
import toast                                                   from 'react-hot-toast';
import { registerUser }                                        from '../api/auth.api';
import useAuthStore                                            from '../store/authStore';
import { APP_NAME }                                            from '../utils/constants';

const VALID_ROLES = ['investor', 'startup'];

const ROLE_META = {
  investor: {
    emoji:    '💼',
    label:    'Investor',
    color:    '#6366f1',
    altColor: '#818cf8',
    glow:     'rgba(99,102,241,0.3)',
    tagline:  'Smart money meets verified startups.',
    sub:      'Join thousands of investors funding India\'s next unicorns.',
    count:    '12,400+ investors',
    features: [
      { icon: '🔍', text: 'Browse KYB-verified startup campaigns' },
      { icon: '📊', text: 'Track milestones in real-time' },
      { icon: '🔐', text: 'Smart contract escrow — funds are always protected' },
      { icon: '🗳️', text: 'Vote on milestone fund releases' },
      { icon: '⛓️', text: 'On-chain transaction receipts forever' },
    ],
  },
  startup: {
    emoji:    '🚀',
    label:    'Startup',
    color:    '#10b981',
    altColor: '#34d399',
    glow:     'rgba(16,185,129,0.3)',
    tagline:  'Raise capital with built-in trust.',
    sub:      'Join hundreds of startups raising transparently on Enigma.',
    count:    '847+ verified startups',
    features: [
      { icon: '🎯', text: 'Create milestone-driven funding campaigns' },
      { icon: '🛡️', text: 'Get KYB verified — build instant investor trust' },
      { icon: '💰', text: 'Receive funds in smart contract escrow' },
      { icon: '📈', text: 'Track investor growth on your dashboard' },
      { icon: '⬡', text: 'CertiK audit badge for your profile' },
    ],
  },
};

const validatePassword = (pw) => {
  if (pw.length < 8)        return 'Password must be at least 8 characters.';
  if (!/[A-Z]/.test(pw))   return 'Must contain at least one uppercase letter.';
  if (!/\d/.test(pw))      return 'Must contain at least one number.';
  return null;
};

export default function Register() {
  /* ── hooks ── */
  const { role }    = useParams();
  const navigate    = useNavigate();
  const { setAuth } = useAuthStore();

  const [form, setForm] = useState({ fullName: '', email: '', password: '', role });
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  /* ── derived ── */
  const isValid = VALID_ROLES.includes(role);
  const meta    = ROLE_META[role] || ROLE_META.investor;
  const altRole = role === 'investor' ? 'startup' : 'investor';

  /* ── handlers ── */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
    if (fieldErrors[name]) setFieldErrors((p) => ({ ...p, [name]: '' }));
    setError('');
  };

  const validate = () => {
    const errs = {};
    if (!form.fullName.trim()) errs.fullName = 'Full name is required.';
    if (!form.email.trim())    errs.email    = 'Email is required.';
    if (!form.password)        errs.password = 'Password is required.';
    else { const e = validatePassword(form.password); if (e) errs.password = e; }
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const errs = validate();
    if (Object.keys(errs).length > 0) { setFieldErrors(errs); return; }
    setLoading(true);
    try {
      const { user, token } = await registerUser(form);
      setAuth(user, token);
      toast.success(`Account created! Welcome to ${APP_NAME}, ${user.fullName.split(' ')[0]}! 🎉`);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err?.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  /* ── guard ── */
  if (!isValid) return <Navigate to="/auth/role?mode=signup" replace />;

  /* ─────────────────────────────────────────────────────────────── */

  return (
    <div style={{
      display:    'flex',
      minHeight:  'calc(100vh - 64px)',
      background: '#07080f',
      fontFamily: "'Inter', sans-serif",
    }}>

      {/* ══════════════════════════════════════════════════════
          LEFT PANEL — form (welcoming, clean, energetic copy)
      ══════════════════════════════════════════════════════ */}
      <div style={{
        flex:           '0 0 55%',
        display:        'flex',
        flexDirection:  'column',
        justifyContent: 'center',
        padding:        '3rem 4rem 3rem 3.5rem',
        background:     '#07080f',
        position:       'relative',
        overflow:       'hidden',
      }}>

        {/* Subtle top-left glow */}
        <div aria-hidden style={{
          position:     'absolute',
          top:          '-60px',
          left:         '-60px',
          width:        '300px',
          height:       '300px',
          borderRadius: '50%',
          background:   `radial-gradient(circle, ${meta.color}12 0%, transparent 70%)`,
          filter:       'blur(50px)',
          pointerEvents:'none',
        }} />

        <div style={{ maxWidth: '420px' }}>

          {/* Step indicator */}
          <div style={{
            display:      'flex',
            alignItems:   'center',
            gap:          '0.5rem',
            marginBottom: '1.75rem',
          }}>
            <div style={{
              width:        '28px',
              height:       '28px',
              borderRadius: '50%',
              background:   `linear-gradient(135deg, ${meta.color}, ${meta.altColor})`,
              display:      'flex',
              alignItems:   'center',
              justifyContent:'center',
              fontSize:     '0.75rem',
              fontWeight:   800,
              color:        '#07080f',
              flexShrink:   0,
            }}>
              1
            </div>
            <span style={{ fontSize: '0.78rem', color: 'rgba(240,242,255,0.35)', letterSpacing: '0.04em' }}>
              Create your account · One step away
            </span>
          </div>

          {/* Role badge */}
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
            marginBottom: '1rem',
          }}>
            {meta.emoji} Signing up as {meta.label}
            {' · '}
            <Link to={`/signup/${altRole}`} style={{ color: 'rgba(240,242,255,0.4)', fontSize: '0.71rem', textDecoration: 'underline' }}>
              switch
            </Link>
          </div>

          <h1 style={{
            fontSize:     'clamp(1.6rem, 2.5vw, 2.1rem)',
            fontWeight:   800,
            color:        '#f0f2ff',
            lineHeight:   1.2,
            margin:       '0 0 0.35rem',
            letterSpacing:'-0.03em',
          }}>
            Start your journey 🎉
          </h1>
          <p style={{
            color:        'rgba(240,242,255,0.4)',
            fontSize:     '0.875rem',
            marginBottom: '2rem',
            lineHeight:   1.6,
          }}>
            {meta.sub}
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
              <label className="form-label form-label--req" htmlFor="reg-fullname">Full name</label>
              <input
                id="reg-fullname" name="fullName" type="text"
                className={`form-input${fieldErrors.fullName ? ' form-input--error' : ''}`}
                placeholder="Jane Smith"
                value={form.fullName} onChange={handleChange}
                required disabled={loading} autoComplete="name"
              />
              {fieldErrors.fullName && <span className="form-error">{fieldErrors.fullName}</span>}
            </div>

            <div className="form-group">
              <label className="form-label form-label--req" htmlFor="reg-email">Email address</label>
              <input
                id="reg-email" name="email" type="email"
                className={`form-input${fieldErrors.email ? ' form-input--error' : ''}`}
                placeholder="you@example.com"
                value={form.email} onChange={handleChange}
                required disabled={loading} autoComplete="email"
              />
              {fieldErrors.email && <span className="form-error">{fieldErrors.email}</span>}
            </div>

            <div className="form-group">
              <label className="form-label form-label--req" htmlFor="reg-password">Password</label>
              <input
                id="reg-password" name="password" type="password"
                className={`form-input${fieldErrors.password ? ' form-input--error' : ''}`}
                placeholder="Min 8 chars · 1 uppercase · 1 number"
                value={form.password} onChange={handleChange}
                required disabled={loading} autoComplete="new-password"
              />
              {fieldErrors.password
                ? <span className="form-error">{fieldErrors.password}</span>
                : <span className="form-hint">Min 8 characters · 1 uppercase · 1 number</span>
              }
            </div>

            <button
              type="submit"
              id="register-submit"
              disabled={loading}
              style={{
                width:          '100%',
                padding:        '14px',
                marginTop:      '0.5rem',
                borderRadius:   '12px',
                border:         'none',
                background:     `linear-gradient(135deg, ${meta.color} 0%, ${meta.altColor} 100%)`,
                color:          '#07080f',
                fontWeight:     800,
                fontSize:       '0.97rem',
                cursor:         loading ? 'not-allowed' : 'pointer',
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                gap:            '0.5rem',
                opacity:        loading ? 0.7 : 1,
                transition:     'all 0.2s ease',
                letterSpacing:  '0.01em',
                boxShadow:      loading ? 'none' : `0 4px 20px ${meta.glow}`,
              }}
              onMouseEnter={(e) => { if (!loading) e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={(e) => { if (!loading) e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              {loading ? (
                <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Creating account…</>
              ) : (
                `Create ${meta.label} Account →`
              )}
            </button>
          </form>

          {/* Footer link */}
          <p style={{
            marginTop: '1.5rem',
            fontSize:  '0.82rem',
            color:     'rgba(240,242,255,0.3)',
            textAlign: 'center',
          }}>
            Already have an account?{' '}
            <Link to={`/login/${role}`} style={{ color: meta.color, fontWeight: 600 }}>
              Log in →
            </Link>
          </p>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          RIGHT PANEL — vibrant, role-accented benefits
      ══════════════════════════════════════════════════════ */}
      <div style={{
        flex:       1,
        position:   'relative',
        overflow:   'hidden',
        background: `linear-gradient(155deg, ${meta.color}22 0%, #07080f 55%, ${meta.altColor}10 100%)`,
        borderLeft: `1px solid ${meta.color}20`,
        display:    'flex',
        flexDirection:'column',
        justifyContent:'center',
        padding:    '3rem 2.5rem 3rem 3rem',
      }}>

        {/* Background decorative blobs */}
        <div aria-hidden style={{
          position:     'absolute',
          top:          '-80px',
          right:        '-80px',
          width:        '380px',
          height:       '380px',
          borderRadius: '50%',
          background:   `radial-gradient(circle, ${meta.color}28 0%, transparent 65%)`,
          filter:       'blur(60px)',
          pointerEvents:'none',
        }} />
        <div aria-hidden style={{
          position:     'absolute',
          bottom:       '-60px',
          left:         '-40px',
          width:        '260px',
          height:       '260px',
          borderRadius: '50%',
          background:   `radial-gradient(circle, ${meta.altColor}1a 0%, transparent 70%)`,
          filter:       'blur(40px)',
          pointerEvents:'none',
        }} />

        {/* Hexagon grid texture */}
        <div aria-hidden style={{
          position:       'absolute',
          inset:          0,
          backgroundImage:`radial-gradient(${meta.color}08 1px, transparent 1px)`,
          backgroundSize: '28px 28px',
          pointerEvents:  'none',
        }} />

        {/* Content */}
        <div style={{ position: 'relative', zIndex: 1 }}>

          {/* Large role icon */}
          <div style={{
            fontSize:     '3.5rem',
            marginBottom: '1.25rem',
            filter:       `drop-shadow(0 0 24px ${meta.glow})`,
          }}>
            {meta.emoji}
          </div>

          <div style={{
            fontSize:      '0.68rem',
            fontWeight:    700,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color:         meta.color,
            marginBottom:  '0.6rem',
          }}>
            What you unlock
          </div>

          <h2 style={{
            fontSize:     'clamp(1.3rem, 2vw, 1.75rem)',
            fontWeight:   800,
            color:        '#f0f2ff',
            lineHeight:   1.25,
            margin:       '0 0 0.5rem',
            letterSpacing:'-0.02em',
          }}>
            {meta.tagline}
          </h2>

          <p style={{
            color:        'rgba(240,242,255,0.45)',
            fontSize:     '0.85rem',
            lineHeight:   1.65,
            marginBottom: '2rem',
          }}>
            Everything you need is already built in. No hidden fees, no lock-ins.
          </p>

          {/* Feature list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '2.5rem' }}>
            {meta.features.map((f, i) => (
              <div key={i} style={{
                display:    'flex',
                alignItems: 'flex-start',
                gap:        '0.85rem',
              }}>
                <div style={{
                  width:         '32px',
                  height:        '32px',
                  borderRadius:  '8px',
                  background:    `${meta.color}1e`,
                  border:        `1px solid ${meta.color}30`,
                  display:       'flex',
                  alignItems:    'center',
                  justifyContent:'center',
                  fontSize:      '1rem',
                  flexShrink:    0,
                }}>
                  {f.icon}
                </div>
                <span style={{
                  fontSize:   '0.875rem',
                  color:      'rgba(240,242,255,0.7)',
                  lineHeight: 1.5,
                  paddingTop: '0.35rem',
                }}>
                  {f.text}
                </span>
              </div>
            ))}
          </div>

          {/* Social proof badge */}
          <div style={{
            display:      'inline-flex',
            alignItems:   'center',
            gap:          '0.6rem',
            padding:      '0.65rem 1.1rem',
            borderRadius: '12px',
            background:   `${meta.color}18`,
            border:       `1px solid ${meta.color}35`,
          }}>
            <div style={{ display: 'flex', marginRight: '0.1rem' }}>
              {['🟢', '🟢', '🟢'].map((_, i) => (
                <div key={i} style={{
                  width:        '22px',
                  height:       '22px',
                  borderRadius: '50%',
                  background:   `linear-gradient(135deg, ${meta.color}, ${meta.altColor})`,
                  border:       '2px solid #07080f',
                  marginLeft:   i > 0 ? '-8px' : 0,
                }} />
              ))}
            </div>
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: meta.color }}>
                {meta.count}
              </div>
              <div style={{ fontSize: '0.68rem', color: 'rgba(240,242,255,0.35)' }}>
                already on the platform
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
