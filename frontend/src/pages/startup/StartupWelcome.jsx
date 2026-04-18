/**
 * src/pages/startup/StartupWelcome.jsx
 *
 * Shown immediately after a new startup founder registers.
 * Route: /startup/welcome
 *
 * Linked from Register.jsx on role === 'startup'.
 * Explains what happens next and directs them to create their startup profile.
 */

import { useNavigate } from 'react-router-dom';
import useAuthStore    from '../../store/authStore';
import { APP_NAME }    from '../../utils/constants';

const STEPS = [
  {
    icon:  '🏢',
    title: 'Create your startup profile',
    desc:  'Add your startup name, description, industry, team members, and verification documents.',
    step:  1,
  },
  {
    icon:  '🛡️',
    title: 'KYB verification',
    desc:  'Our team reviews your documents (typically 24–48 hours). You\'ll be notified when approved.',
    step:  2,
  },
  {
    icon:  '🚀',
    title: 'Launch your campaign',
    desc:  'Once verified, create a milestone-driven campaign and start receiving investments.',
    step:  3,
  },
];

export default function StartupWelcome() {
  const navigate       = useNavigate();
  const { user, role } = useAuthStore();

  // Guard: only for startup users
  if (role && role !== 'startup') {
    navigate('/dashboard', { replace: true });
    return null;
  }

  const firstName = user?.fullName?.split(' ')[0] ?? 'Founder';

  return (
    <div style={{
      minHeight:      'calc(100vh - 64px)',
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      padding:        '3rem 1.5rem',
      background:     'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(16,185,129,0.12), transparent 65%)',
      position:       'relative',
      overflow:       'hidden',
    }}>

      {/* Grid texture */}
      <div aria-hidden style={{
        position:        'absolute',
        inset:           0,
        backgroundImage: 'radial-gradient(rgba(16,185,129,0.06) 1px, transparent 1px)',
        backgroundSize:  '32px 32px',
        pointerEvents:   'none',
      }} />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 640, textAlign: 'center' }}>

        {/* Logo */}
        <div style={{
          fontSize:             '1.05rem',
          fontWeight:           900,
          letterSpacing:        '0.04em',
          background:           'linear-gradient(135deg, #fff 40%, #34d399 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor:  'transparent',
          marginBottom:         '2.5rem',
        }}>
          ✦ {APP_NAME.split(' ')[0].toUpperCase()}
        </div>

        {/* Rocket burst */}
        <div style={{ fontSize: '4rem', lineHeight: 1, marginBottom: '1.25rem' }}>🚀</div>

        {/* Headline */}
        <div style={{
          display:       'inline-flex',
          alignItems:    'center',
          gap:           '0.4rem',
          padding:       '0.3rem 1rem',
          borderRadius:  '999px',
          background:    'rgba(16,185,129,0.1)',
          border:        '1px solid rgba(16,185,129,0.25)',
          fontSize:      '0.75rem',
          fontWeight:    600,
          color:         '#34d399',
          letterSpacing: '0.04em',
          marginBottom:  '1.25rem',
        }}>
          ✨ Account created
        </div>

        <h1 style={{
          fontSize:      'clamp(1.9rem, 4vw, 2.8rem)',
          fontWeight:    800,
          color:         '#f0f2ff',
          margin:        '0 0 0.75rem',
          lineHeight:    1.2,
          letterSpacing: '-0.03em',
        }}>
          Welcome, {firstName}! 🎉
        </h1>

        <p style={{
          color:        'rgba(240,242,255,0.45)',
          fontSize:     '1rem',
          lineHeight:   1.7,
          maxWidth:     460,
          margin:       '0 auto 3rem',
        }}>
          Your founder account is ready. Here's what happens next to get your startup funded.
        </p>

        {/* Steps */}
        <div style={{
          display:       'grid',
          gap:           '1rem',
          marginBottom:  '2.5rem',
          textAlign:     'left',
        }}>
          {STEPS.map((s) => (
            <div
              key={s.step}
              style={{
                display:      'flex',
                gap:          '1.25rem',
                alignItems:   'flex-start',
                padding:      '1.25rem 1.5rem',
                background:   'rgba(16,185,129,0.05)',
                border:       '1px solid rgba(16,185,129,0.12)',
                borderRadius: '14px',
              }}
            >
              {/* Step number */}
              <div style={{
                width:          36,
                height:         36,
                borderRadius:   '50%',
                background:     'rgba(16,185,129,0.15)',
                border:         '1px solid rgba(16,185,129,0.3)',
                color:          '#34d399',
                fontWeight:     800,
                fontSize:       '0.9rem',
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                flexShrink:     0,
              }}>
                {s.step}
              </div>

              {/* Text */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <span style={{ fontSize: '1.2rem' }}>{s.icon}</span>
                  <span style={{ fontWeight: 700, color: '#f0f2ff', fontSize: '0.95rem' }}>{s.title}</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.82rem', color: 'rgba(240,242,255,0.45)', lineHeight: 1.6 }}>
                  {s.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <button
          id="startup-welcome-create-profile"
          onClick={() => navigate('/startup/onboarding')}
          style={{
            width:          '100%',
            maxWidth:       400,
            padding:        '14px',
            borderRadius:   '12px',
            border:         'none',
            background:     'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
            color:          '#06080f',
            fontWeight:     700,
            fontSize:       '1rem',
            cursor:         'pointer',
            letterSpacing:  '0.01em',
            transition:     'opacity 0.2s',
            marginBottom:   '1rem',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
        >
          🏢 Create my startup profile →
        </button>

        <br />

        <button
          id="startup-welcome-skip"
          onClick={() => navigate('/dashboard')}
          style={{
            background:    'none',
            border:        'none',
            cursor:        'pointer',
            fontSize:      '0.82rem',
            color:         'rgba(240,242,255,0.35)',
            padding:       '0.5rem',
          }}
        >
          Skip for now — go to dashboard
        </button>
      </div>
    </div>
  );
}
