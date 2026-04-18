/**
 * src/pages/dashboard/StartupDashboard.jsx
 *
 * Startup overview dashboard.
 * Fetches own profile (GET /api/v1/startups/me) and own campaigns
 * (GET /api/v1/campaigns/my) on mount.
 *
 * - Profile missing  → prominent "Complete your profile" gate
 * - Profile exists   → completeness bar + real campaign list + stats
 */

import { useState, useEffect }     from 'react';
import { Link, useNavigate }       from 'react-router-dom';
import useAuthStore                from '../../store/authStore';
import { getMyStartupProfile }     from '../../api/startups.api';
import { getMyCampaigns }          from '../../api/campaigns.api';
import { formatINR }               from '../../utils/formatters';

// ─── Status badge ─────────────────────────────────────────────────────────────
const STATUS_META = {
  draft:     { color: 'var(--color-text-muted)',   bg: 'rgba(148,163,184,0.1)',  label: 'Draft'     },
  active:    { color: 'var(--color-success)',       bg: 'rgba(16,185,129,0.1)',   label: 'Active'    },
  paused:    { color: 'var(--color-warning)',       bg: 'rgba(245,158,11,0.1)',   label: 'Paused'    },
  funded:    { color: 'var(--color-secondary)',     bg: 'rgba(139,92,246,0.1)',   label: 'Funded'    },
  completed: { color: 'var(--color-primary)',       bg: 'rgba(99,102,241,0.1)',   label: 'Completed' },
  cancelled: { color: 'var(--color-error)',         bg: 'rgba(239,68,68,0.1)',    label: 'Cancelled' },
};

function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META.draft;
  return (
    <span style={{
      fontSize:     '0.7rem',
      fontWeight:   600,
      padding:      '0.2rem 0.55rem',
      borderRadius: 99,
      background:   m.bg,
      color:        m.color,
      textTransform:'uppercase',
      letterSpacing:'0.04em',
    }}>
      {m.label}
    </span>
  );
}

// ─── Campaign card ────────────────────────────────────────────────────────────
function CampaignCard({ campaign }) {
  const raised   = campaign.currentRaised ?? 0;
  const goal     = campaign.fundingGoal ?? 1;
  const pct      = Math.min(100, Math.round((raised / goal) * 100));
  const currency = campaign.currency || 'INR';
  const isDraft  = campaign.status === 'draft';

  return (
    <div style={{
      background:   isDraft ? 'rgba(245,158,11,0.025)' : 'rgba(99,102,241,0.03)',
      border:       `1px solid ${isDraft ? 'rgba(245,158,11,0.2)' : 'var(--color-border)'}`,
      borderRadius: 'var(--r-lg)',
      padding:      '1rem 1.25rem',
      marginBottom: '0.75rem',
      transition:   'border-color 0.2s ease, box-shadow 0.2s ease',
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.borderColor = isDraft ? 'rgba(245,158,11,0.4)' : 'rgba(99,102,241,0.4)';
      e.currentTarget.style.boxShadow   = isDraft ? '0 0 0 1px rgba(245,158,11,0.1)' : '0 0 0 1px rgba(99,102,241,0.15)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.borderColor = isDraft ? 'rgba(245,158,11,0.2)' : 'var(--color-border)';
      e.currentTarget.style.boxShadow  = 'none';
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
        <div style={{ fontWeight: 600, fontSize: '0.92rem', flex: 1, marginRight: '0.5rem' }}>
          {campaign.title}
        </div>
        <StatusBadge status={campaign.status} />
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, background: 'var(--color-border)', borderRadius: 99, overflow: 'hidden', marginBottom: '0.4rem' }}>
        <div style={{
          height:      '100%',
          width:       `${pct}%`,
          background:  'linear-gradient(90deg, var(--color-primary), var(--color-accent))',
          borderRadius: 99,
          transition:  'width 0.5s ease',
        }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
        <span>{raised} / {goal} {currency} raised · {pct}%</span>
        <span>{campaign.milestoneCount} milestone{campaign.milestoneCount !== 1 ? 's' : ''}</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
            📅 {new Date(campaign.deadline).toLocaleDateString()}
          </span>
          <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
            👥 {campaign.investorCount ?? 0} investor{(campaign.investorCount ?? 0) !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Status-aware action */}
        {isDraft && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--color-warning)', fontWeight: 500 }}>
              ⚠️ Draft
            </span>
            <Link
              to={`/dashboard/campaigns/${campaign._id}`}
              style={{
                fontSize:     '0.72rem',
                fontWeight:   600,
                color:        'var(--color-primary)',
                padding:      '0.2rem 0.55rem',
                border:       '1px solid var(--color-primary)',
                borderRadius: 99,
                textDecoration: 'none',
                transition:   'background 0.2s',
              }}
            >
              ⚡ Manage &amp; Activate
            </Link>
          </div>
        )}
        {campaign.status === 'active' && (
          <Link
            to={`/dashboard/campaigns/${campaign._id}`}
            style={{
              fontSize:     '0.72rem',
              fontWeight:   600,
              color:        'var(--color-success)',
              textDecoration: 'none',
            }}
          >
            ✓ Live → View
          </Link>
        )}
      </div>
    </div>
  );
}

// ─── Completeness mini-bar ────────────────────────────────────────────────────
function MiniCompletenessBar({ score, label }) {
  const color =
    score >= 90 ? 'var(--color-success)' :
    score >= 70 ? 'var(--color-secondary)' :
    score >= 50 ? 'var(--color-warning)' :
    'var(--color-error)';

  return (
    <div style={{
      background:   'rgba(99,102,241,0.05)',
      border:       '1px solid var(--color-border)',
      borderRadius: 'var(--r-lg)',
      padding:      '1rem 1.25rem',
      marginBottom: '1.5rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Profile Completeness</span>
        <span style={{ fontSize: '0.8rem', color, fontWeight: 700 }}>{score}% — {label}</span>
      </div>
      <div style={{ height: 6, background: 'var(--color-border)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{
          height:      '100%',
          width:       `${score}%`,
          background:  `linear-gradient(90deg, var(--color-primary), ${color})`,
          borderRadius: 99,
          transition:  'width 0.6s ease',
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
        <Link to="/startup/onboarding" style={{ fontSize: '0.78rem', color: 'var(--color-primary)', fontWeight: 500 }}>
          Edit profile →
        </Link>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function StartupDashboard() {
  const { user }   = useAuthStore();
  const navigate   = useNavigate();

  const [profile,   setProfile]   = useState(undefined); // undefined = loading
  const [campaigns, setCampaigns] = useState(undefined);
  const [loadErr,   setLoadErr]   = useState('');

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [p, c] = await Promise.all([
          getMyStartupProfile(),
          getMyCampaigns().catch(() => []),
        ]);
        if (!cancelled) {
          setProfile(p);
          setCampaigns(c);
        }
      } catch (err) {
        if (!cancelled) setLoadErr('Could not load dashboard data.');
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  // Verification Guard
  useEffect(() => {
    if (profile) {
      if (['pending', 'in_review', 'rejected', 'more_info_required'].includes(profile.verificationStatus)) {
        navigate('/startup/pending-verification', { replace: true });
      } else if (profile.verificationStatus === 'draft') {
        navigate('/startup/onboarding', { replace: true });
      }
    }
  }, [profile, navigate]);

  const isLoading      = profile === undefined;
  const hasProfile     = !!profile && profile.verificationStatus === 'approved'; // Must be approved to proceed
  const score          = profile?.profileCompleteness ?? 0;
  const completenessLabel = profile?.completenessLabel ?? 'Incomplete';

  // Stats derived from real campaigns
  const totalRaised    = (campaigns ?? []).reduce((s, c) => s + (c.currentRaised ?? 0), 0).toFixed(2);
  const totalInvestors = (campaigns ?? []).reduce((s, c) => s + (c.investorCount ?? 0), 0);
  const campaignCount  = (campaigns ?? []).length;
  const disbursedMs    = (campaigns ?? []).reduce((s, c) => s + (c.currentMilestoneIndex ?? 0), 0);
  const totalMs        = (campaigns ?? []).reduce((s, c) => s + (c.milestoneCount ?? 0), 0);

  const currency = campaigns?.[0]?.currency || 'INR';

  const STATS = [
    { emoji: '💰', value: formatINR(totalRaised),   label: 'Total Raised'    },
    { emoji: '👥', value: `${totalInvestors}`,       label: 'Total Investors' },
    { emoji: '📋', value: `${campaignCount}`,        label: 'Campaigns'       },
    { emoji: '🏁', value: `${disbursedMs} / ${totalMs}`, label: 'Milestones Done' },
  ];

  return (
    <div className="animate-fade-in">

      {/* Header */}
      <div className="dashboard__header">
        <h2>🚀 Startup Dashboard</h2>
        <p className="text-muted text-sm" style={{ marginTop: '0.35rem' }}>
          {hasProfile
            ? `${profile.startupName} · ${completenessLabel} profile`
            : 'Manage your campaigns, milestones, and investor activity.'}
        </p>
      </div>

      {/* Profile gate */}
      {!isLoading && !hasProfile && !loadErr && (
        <div style={{
          background:   'rgba(245,158,11,0.07)',
          border:       '1px solid rgba(245,158,11,0.25)',
          borderRadius: 'var(--r-lg)',
          padding:      '1.5rem 1.75rem',
          marginBottom: '1.5rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
            <span style={{ fontSize: '2rem' }}>⚠️</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, marginBottom: '0.35rem' }}>
                Complete your startup profile to get started
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
                You need a startup profile before you can create fundraising campaigns.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <Link to="/startup/onboarding" className="btn btn--primary btn--sm">
                  🏢 Complete Onboarding
                </Link>
                <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', alignSelf: 'center' }}>
                  Required to create campaigns
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div className="skeleton" style={{ height: 70, borderRadius: 'var(--r-lg)', marginBottom: '1.5rem' }} />
      )}

      {/* Completeness bar */}
      {hasProfile && (
        <MiniCompletenessBar score={score} label={completenessLabel} />
      )}

      {/* Stats */}
      <div className="stats-row" style={{ marginBottom: '1.5rem' }}>
        {STATS.map((s) => (
          <div className="stat-card" key={s.label}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{s.emoji}</div>
            <div className="stat-card__value">{s.value}</div>
            <div className="stat-card__label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Campaigns */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h3 style={{ margin: 0 }}>My Campaigns</h3>
            {campaigns !== undefined && campaigns.length > 0 && (
              <Link to="/dashboard/campaigns" style={{ fontSize: '0.78rem', color: 'var(--color-primary)', fontWeight: 500 }}>
                View all →
              </Link>
            )}
          </div>
          {hasProfile ? (
            <Link to="/dashboard/campaigns/new" className="btn btn--primary btn--sm">
              ＋ New Campaign
            </Link>
          ) : (
            <button className="btn btn--primary btn--sm" disabled>
              ＋ New Campaign
            </button>
          )}
        </div>

        {/* Campaign loading skeleton */}
        {campaigns === undefined && (
          <>
            <div className="skeleton" style={{ height: 84, marginBottom: '0.75rem' }} />
            <div className="skeleton" style={{ height: 84 }} />
          </>
        )}

        {/* Real campaigns */}
        {campaigns !== undefined && campaigns.length > 0 && campaigns.map((c) => (
          <CampaignCard key={c._id} campaign={c} />
        ))}

        {/* Empty state */}
        {campaigns !== undefined && campaigns.length === 0 && (
          <div className="empty-state" style={{ padding: '2.5rem 1rem' }}>
            <span className="empty-state__emoji">📋</span>
            <p className="empty-state__title">No campaigns yet.</p>
            <p className="text-muted text-sm" style={{ marginBottom: '1.25rem' }}>
              {hasProfile
                ? 'Create your first fundraising campaign to start raising funds securely.'
                : 'Set up your startup profile first, then create campaigns.'}
            </p>
            {hasProfile ? (
              <Link to="/dashboard/campaigns/new" className="btn btn--primary btn--sm">
                🚀 Create Campaign
              </Link>
            ) : (
              <Link to="/startup/onboarding" className="btn btn--secondary btn--sm">
                🏢 Set Up Profile First
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Pending actions */}
      <div className="card">
        <h3 style={{ marginBottom: '1rem' }}>⏳ Pending Actions</h3>
        {campaigns === undefined && (
          <div className="skeleton" style={{ height: 60 }} />
        )}
        {campaigns !== undefined && (() => {
          const drafts = campaigns.filter((c) => c.status === 'draft');
          if (drafts.length === 0) {
            return (
              <div className="empty-state" style={{ padding: '1.5rem 1rem' }}>
                <p className="text-muted text-sm">
                  Milestone submissions and approval actions will appear here once you have active campaigns.
                </p>
              </div>
            );
          }
          return (
            <div>
              <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
                The following campaigns are in <strong>Draft</strong> status.
                To go live, each campaign needs milestones defined and then must be activated.
              </p>
              {drafts.map((c) => (
                <div key={c._id} style={{
                  display:      'flex',
                  alignItems:   'center',
                  justifyContent: 'space-between',
                  padding:      '0.65rem 0.9rem',
                  borderRadius: 'var(--r-md)',
                  background:   'rgba(245,158,11,0.06)',
                  border:       '1px solid rgba(245,158,11,0.18)',
                  marginBottom: '0.5rem',
                  gap:          '0.75rem',
                  flexWrap:     'wrap',
                }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{c.title}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '0.15rem' }}>
                      {c.milestoneCount} milestone{c.milestoneCount !== 1 ? 's' : ''} planned
                      · Deadline {new Date(c.deadline).toLocaleDateString()}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                    <Link
                      to={`/dashboard/campaigns/${c._id}`}
                      className="btn btn--primary btn--sm"
                      style={{ fontSize: '0.75rem' }}
                    >
                      ⚡ Manage &amp; Activate
                    </Link>
                  </div>
                </div>
              ))}
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.75rem' }}>
                💡 Activation registers the campaign for full transparency tracking.
              </p>
            </div>
          );
        })()}
      </div>

    </div>
  );
}
