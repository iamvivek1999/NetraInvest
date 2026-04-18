/**
 * src/pages/startup/StartupPendingVerification.jsx
 *
 * Shown when a startup founder logs in but their profile is:
 *   - created (profile exists)
 *   - but verificationStatus is NOT 'approved'
 *
 * Route: /startup/pending-verification
 *
 * Possible verificationStatus values:
 *   pending              → just submitted, not yet reviewed
 *   in_review            → admin is actively reviewing
 *   more_info_required   → admin needs more documents
 *   rejected             → failed — can resubmit
 */

import { useEffect }   from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery }    from '@tanstack/react-query';
import useAuthStore    from '../../store/authStore';
import client          from '../../api/client';
import { APP_NAME }    from '../../utils/constants';

// ─── Status config ─────────────────────────────────────────────────────────────
const STATUS_META = {
  pending: {
    icon:    '⏳',
    color:   '#f59e0b',
    label:   'Under Review',
    heading: 'Your application is in the queue',
    desc:    'Our compliance team reviews every startup within 24–48 business hours. You\'ll receive a notification once reviewed.',
  },
  in_review: {
    icon:    '🔍',
    color:   '#6366f1',
    label:   'Being Reviewed',
    heading: 'Actively being reviewed',
    desc:    'Our team is currently reviewing your documents. This typically takes a few hours. Sit tight!',
  },
  more_info_required: {
    icon:    '📋',
    color:   '#ef4444',
    label:   'More Info Needed',
    heading: 'Additional information required',
    desc:    'Our team needs more information to complete verification. Please update your startup profile with the requested documents.',
  },
  rejected: {
    icon:    '❌',
    color:   '#ef4444',
    label:   'Application Rejected',
    heading: 'Verification was not successful',
    desc:    'Unfortunately your application was rejected. You can review the reason below and resubmit with updated information.',
  },
};

const CHECKLIST = [
  { icon: '🏢', text: 'Company registration (MCA / Certificate of Incorporation)' },
  { icon: '🪪', text: 'PAN card of the entity' },
  { icon: '📍', text: 'Registered address proof' },
  { icon: '📊', text: 'Pitch deck (optional but recommended)' },
  { icon: '💰', text: 'Latest financials or revenue summary' },
];

export default function StartupPendingVerification() {
  const navigate       = useNavigate();
  const { user, role } = useAuthStore();

  // Guard
  useEffect(() => {
    if (role && role !== 'startup') navigate('/dashboard', { replace: true });
  }, [role, navigate]);

  // Fetch current startup profile to get verificationStatus + rejectionReason
  const { data: profileData, isLoading } = useQuery({
    queryKey: ['startup-profile-me'],
    queryFn:  async () => {
      const res = await client.get('/startups/me');
      return res.data?.data?.profile ?? null;
    },
    staleTime: 30_000,
  });

  useEffect(() => {
    if (profileData?.verificationStatus === 'approved') {
      navigate('/dashboard', { replace: true });
    }
  }, [profileData, navigate]);

  const profile = profileData;
  const status  = profile?.verificationStatus ?? 'pending';
  const meta    = STATUS_META[status] ?? STATUS_META.pending;

  const firstName = user?.fullName?.split(' ')[0] ?? 'Founder';

  return (
    <div style={{
      minHeight:      'calc(100vh - 64px)',
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      padding:        '3rem 1.5rem',
      background:     `radial-gradient(ellipse 80% 50% at 50% -10%, ${meta.color}18, transparent 65%)`,
    }}>

      <div style={{ width: '100%', maxWidth: 620, textAlign: 'center' }}>

        {/* Logo */}
        <div style={{
          fontSize:             '1.05rem',
          fontWeight:           900,
          letterSpacing:        '0.04em',
          background:           'linear-gradient(135deg, #fff 40%, #a78bfa 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor:  'transparent',
          marginBottom:         '2.5rem',
        }}>
          ✦ {APP_NAME.split(' ')[0].toUpperCase()}
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div className="spinner" style={{ width: 40, height: 40, borderWidth: 4 }} />
          </div>
        ) : (
          <>
            {/* Status icon + badge */}
            <div style={{ fontSize: '3.5rem', lineHeight: 1, marginBottom: '1rem' }}>{meta.icon}</div>

            <div style={{
              display:       'inline-flex',
              alignItems:    'center',
              gap:           '0.4rem',
              padding:       '0.3rem 1rem',
              borderRadius:  '999px',
              background:    `${meta.color}18`,
              border:        `1px solid ${meta.color}35`,
              fontSize:      '0.75rem',
              fontWeight:    600,
              color:         meta.color,
              marginBottom:  '1.25rem',
            }}>
              {meta.label}
            </div>

            <h1 style={{
              fontSize:      'clamp(1.6rem, 3.5vw, 2.4rem)',
              fontWeight:    800,
              color:         '#f0f2ff',
              margin:        '0 0 0.75rem',
              lineHeight:    1.2,
              letterSpacing: '-0.03em',
            }}>
              {meta.heading}
            </h1>

            <p style={{
              color:       'rgba(240,242,255,0.45)',
              fontSize:    '0.9rem',
              lineHeight:  1.7,
              maxWidth:    460,
              margin:      '0 auto 2rem',
            }}>
              Hi {firstName}, {meta.desc}
            </p>

            {/* Rejection reason box */}
            {(status === 'rejected' || status === 'more_info_required') && profile?.rejectionReason && (
              <div style={{
                padding:      '1rem 1.25rem',
                background:   'rgba(239,68,68,0.06)',
                border:       '1px solid rgba(239,68,68,0.25)',
                borderRadius: '12px',
                marginBottom: '2rem',
                textAlign:    'left',
              }}>
                <div style={{ fontWeight: 700, color: '#f87171', fontSize: '0.82rem', marginBottom: '0.35rem' }}>
                  📋 Admin feedback:
                </div>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'rgba(240,242,255,0.55)', lineHeight: 1.6 }}>
                  {profile.rejectionReason}
                </p>
              </div>
            )}

            {/* Submitted Company Summary */}
            {(status === 'pending' || status === 'in_review') && profile && (
              <div style={{
                padding:      '1.25rem 1.5rem',
                background:   'rgba(255,255,255,0.02)',
                border:       '1px solid rgba(255,255,255,0.08)',
                borderRadius: '14px',
                marginBottom: '2rem',
                textAlign:    'left',
              }}>
                <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'rgba(240,242,255,0.4)', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Submitted Profile Summary
                </div>
                
                <h3 style={{ margin: '0 0 0.5rem', color: '#f0f2ff', fontSize: '1.2rem', fontWeight: 700 }}>
                  {profile.companyName}
                </h3>
                
                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
                  {profile.industry && (
                    <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: '4px', background: 'rgba(52, 211, 153, 0.1)', color: '#34d399' }}>
                      {profile.industry}
                    </span>
                  )}
                  {profile.companyStage && (
                    <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: '4px', background: 'rgba(99, 102, 241, 0.1)', color: '#818cf8' }}>
                      {profile.companyStage}
                    </span>
                  )}
                </div>

                <p style={{ margin: 0, fontSize: '0.875rem', color: 'rgba(240,242,255,0.6)', lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {profile.pitchSummary || 'No summary provided.'}
                </p>
              </div>
            )}

            {/* Document checklist */}
            <div style={{
              background:    'rgba(255,255,255,0.02)',
              border:        '1px solid rgba(255,255,255,0.06)',
              borderRadius:  '14px',
              padding:       '1.25rem 1.5rem',
              marginBottom:  '2rem',
              textAlign:     'left',
            }}>
              <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'rgba(240,242,255,0.4)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Verification checklist
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {CHECKLIST.map((item) => (
                  <div key={item.text} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '1rem' }}>{item.icon}</span>
                    <span style={{ fontSize: '0.82rem', color: 'rgba(240,242,255,0.5)' }}>{item.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center' }}>
              {(status === 'more_info_required' || status === 'rejected') && (
                <button
                  id="startup-pending-update-profile"
                  onClick={() => navigate('/dashboard/profile')}
                  style={{
                    width:        '100%',
                    maxWidth:     360,
                    padding:      '13px',
                    borderRadius: '12px',
                    border:       'none',
                    background:   `linear-gradient(135deg, ${meta.color} 0%, #34d399 100%)`,
                    color:        '#06080f',
                    fontWeight:   700,
                    fontSize:     '0.95rem',
                    cursor:       'pointer',
                    transition:   'opacity 0.2s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
                >
                  📝 Update my profile
                </button>
              )}

              <button
                id="startup-pending-dashboard"
                onClick={() => navigate('/dashboard')}
                style={{
                  background:    'rgba(255,255,255,0.04)',
                  border:        '1px solid rgba(255,255,255,0.08)',
                  borderRadius:  '10px',
                  padding:       '11px 24px',
                  color:         'rgba(240,242,255,0.55)',
                  fontSize:      '0.875rem',
                  fontWeight:    500,
                  cursor:        'pointer',
                  transition:    'all 0.2s',
                  width:         '100%',
                  maxWidth:      360,
                }}
              >
                Go to dashboard →
              </button>

              {/* Refresh hint */}
              <p style={{ fontSize: '0.75rem', color: 'rgba(240,242,255,0.2)', margin: '0.5rem 0 0' }}>
                Status updates automatically. You'll also be notified by email.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
