/**
 * src/pages/RoleSelect.jsx
 *
 * Gateway page — show before login or signup so user picks their role.
 * ?mode=login  → "Welcome back" energy
 * ?mode=signup → "Get started" energy
 */

import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { APP_NAME }                            from '../utils/constants';

const ROLES = [
  {
    value:    'investor',
    emoji:    '💼',
    title:    'Investor',
    subtitle: 'I want to fund startups',
    desc:     'Discover KYB-verified campaigns, invest via wallet or Razorpay, and track milestones with full on-chain transparency.',
    color:    '#6366f1',
    alt:      '#818cf8',
    tags:     ['Browse Campaigns', 'Investor Voting', 'On-Chain Records'],
  },
  {
    value:    'startup',
    emoji:    '🚀',
    title:    'Startup',
    subtitle: 'I want to raise funds',
    desc:     'Create milestone-driven campaigns, get KYB verified, and receive investment into smart contract escrow.',
    color:    '#10b981',
    alt:      '#34d399',
    tags:     ['Create Campaign', 'Escrow Protection', 'KYB Verified'],
  },
];

export default function RoleSelect() {
  const [searchParams] = useSearchParams();
  const navigate        = useNavigate();

  const mode    = searchParams.get('mode') === 'signup' ? 'signup' : 'login';
  const isLogin = mode === 'login';

  const altMode  = isLogin ? 'signup' : 'login';
  const altText  = isLogin
    ? "Don't have an account? Sign up →"
    : 'Already have an account? Log in →';

  return (
    <div style={{
      minHeight:       'calc(100vh - 64px)',
      display:         'flex',
      flexDirection:   'column',
      alignItems:      'center',
      justifyContent:  'center',
      padding:         '3rem 1.5rem',
      background:      'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(99,102,241,0.12), transparent 60%)',
      position:        'relative',
      overflow:        'hidden',
    }}>

      {/* Grid texture */}
      <div aria-hidden style={{
        position:       'absolute',
        inset:          0,
        backgroundImage:'radial-gradient(rgba(99,102,241,0.06) 1px, transparent 1px)',
        backgroundSize: '32px 32px',
        pointerEvents:  'none',
      }} />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '680px', textAlign: 'center' }}>

        {/* Logo */}
        <div style={{
          fontSize:             '1.1rem',
          fontWeight:           900,
          letterSpacing:        '0.04em',
          background:           'linear-gradient(135deg, #fff 40%, #a78bfa 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor:  'transparent',
          marginBottom:         '2rem',
        }}>
          ✦ {APP_NAME.split(' ')[0].toUpperCase()}
        </div>

        {/* Mode pill */}
        <div style={{
          display:       'inline-flex',
          alignItems:    'center',
          gap:           '0.4rem',
          padding:       '0.3rem 1rem',
          borderRadius:  '999px',
          background:    'rgba(99,102,241,0.1)',
          border:        '1px solid rgba(99,102,241,0.25)',
          fontSize:      '0.75rem',
          fontWeight:    600,
          color:         '#818cf8',
          letterSpacing: '0.04em',
          marginBottom:  '1.25rem',
        }}>
          {isLogin ? '🔑 Sign in to your account' : '✨ Create your account'}
        </div>

        <h1 style={{
          fontSize:     'clamp(1.75rem, 3.5vw, 2.5rem)',
          fontWeight:   800,
          color:        '#f0f2ff',
          lineHeight:   1.2,
          margin:       '0 0 0.6rem',
          letterSpacing:'-0.03em',
        }}>
          {isLogin ? 'Welcome back' : 'Join the platform'}
        </h1>
        <p style={{
          color:        'rgba(240,242,255,0.4)',
          fontSize:     '0.9rem',
          marginBottom: '2.5rem',
          lineHeight:   1.6,
          maxWidth:     '420px',
          margin:       '0 auto 2.5rem',
        }}>
          {isLogin
            ? 'Choose your account type to continue.'
            : 'Pick your role and start your journey on the transparent investment platform.'
          }
        </p>

        {/* Role cards */}
        <div style={{
          display:             'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap:                 '1.25rem',
          marginBottom:        '2rem',
        }}>
          {ROLES.map((r) => (
            <button
              key={r.value}
              id={`role-${r.value}-${mode}`}
              onClick={() => navigate(isLogin ? `/login/${r.value}` : `/signup/${r.value}`)}
              style={{
                background:    '#0d0e1f',
                border:        '2px solid rgba(255,255,255,0.08)',
                borderRadius:  '16px',
                padding:       '1.75rem 1.5rem',
                cursor:        'pointer',
                textAlign:     'left',
                transition:    'all 0.22s ease',
                display:       'flex',
                flexDirection: 'column',
                gap:           '0.6rem',
                outline:       'none',
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget;
                el.style.border     = `2px solid ${r.color}`;
                el.style.background = `${r.color}0e`;
                el.style.transform  = 'translateY(-3px)';
                el.style.boxShadow  = `0 12px 32px ${r.color}20`;
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget;
                el.style.border     = '2px solid rgba(255,255,255,0.08)';
                el.style.background = '#0d0e1f';
                el.style.transform  = 'translateY(0)';
                el.style.boxShadow  = 'none';
              }}
            >
              {/* Emoji + title row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '2.25rem', lineHeight: 1 }}>{r.emoji}</span>
                <span style={{
                  fontSize:     '0.7rem',
                  fontWeight:   600,
                  color:        r.color,
                  padding:      '0.2rem 0.55rem',
                  borderRadius: '999px',
                  background:   `${r.color}18`,
                  border:       `1px solid ${r.color}30`,
                }}>
                  {isLogin ? 'Log in →' : 'Sign up →'}
                </span>
              </div>

              <div>
                <div style={{ fontWeight: 700, fontSize: '1.1rem', color: r.color, marginBottom: '0.15rem' }}>
                  {r.title}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'rgba(240,242,255,0.4)', fontStyle: 'italic' }}>
                  {r.subtitle}
                </div>
              </div>

              <p style={{
                fontSize:   '0.82rem',
                color:      'rgba(240,242,255,0.5)',
                lineHeight: 1.55,
                margin:     '0.15rem 0 0.35rem',
              }}>
                {r.desc}
              </p>

              {/* Tag pills */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: 'auto' }}>
                {r.tags.map((t) => (
                  <span key={t} style={{
                    fontSize:     '0.65rem',
                    padding:      '0.18rem 0.5rem',
                    borderRadius: '999px',
                    background:   `${r.color}18`,
                    color:        r.color,
                    fontWeight:   600,
                    letterSpacing:'0.02em',
                  }}>
                    {t}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>

        {/* Alt mode link */}
        <p style={{ fontSize: '0.85rem', color: 'rgba(240,242,255,0.3)' }}>
          <Link
            to={`/auth/role?mode=${altMode}`}
            style={{ color: 'rgba(240,242,255,0.55)', fontWeight: 500, textDecoration: 'underline' }}
          >
            {altText}
          </Link>
        </p>
      </div>
    </div>
  );
}
