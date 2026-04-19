/**
 * src/pages/dashboard/MyCampaigns.jsx
 *
 * Full campaigns list page for the authenticated startup.
 * Fetches GET /api/v1/campaigns/my and renders rich cards
 * linking to CampaignManager for each campaign.
 *
 * Endpoints:
 *   GET /api/v1/campaigns/my — paginated list of own campaigns
 */

import { useState, useEffect } from 'react';
import { Link }                 from 'react-router-dom';
import { getMyCampaigns }       from '../../api/campaigns.api';
import { formatINR }            from '../../utils/formatters';

// ─── Status meta ─────────────────────────────────────────────────────────────

const STATUS_META = {
  draft:     { color: 'var(--color-warning)',   bg: 'rgba(245,158,11,0.1)',  label: 'Draft',     icon: '📝', border: 'rgba(245,158,11,0.25)' },
  active:    { color: 'var(--color-success)',   bg: 'rgba(16,185,129,0.1)',  label: 'Active',    icon: '🟢', border: 'rgba(16,185,129,0.25)'  },
  paused:    { color: 'var(--color-warning)',   bg: 'rgba(245,158,11,0.1)',  label: 'Paused',    icon: '⏸️',  border: 'rgba(245,158,11,0.25)' },
  funded:    { color: 'var(--color-secondary)', bg: 'rgba(139,92,246,0.1)', label: 'Funded',    icon: '🎉', border: 'rgba(139,92,246,0.25)' },
  completed: { color: 'var(--color-primary)',   bg: 'rgba(99,102,241,0.1)', label: 'Completed', icon: '✅', border: 'rgba(99,102,241,0.25)' },
  cancelled: { color: 'var(--color-error)',     bg: 'rgba(239,68,68,0.1)',  label: 'Cancelled', icon: '❌', border: 'rgba(239,68,68,0.15)'  },
};

// ─── Campaign card ────────────────────────────────────────────────────────────

function CampaignCard({ campaign }) {
  const meta     = STATUS_META[campaign.localStatus] || STATUS_META.draft;
  const raised   = campaign.currentRaised   ?? 0;
  const goal     = campaign.fundingGoal     ?? 1;
  const pct      = Math.min(100, Math.round((raised / goal) * 100));
  const currency = campaign.currency        || 'INR';
  const isDraft  = campaign.localStatus === 'draft';

  return (
    <div style={{
      background:   'var(--color-surface)',
      border:       `1px solid ${meta.border}`,
      borderRadius: 'var(--r-lg)',
      padding:      '1.25rem',
      marginBottom: '1rem',
      transition:   'transform 0.18s ease, box-shadow 0.18s ease',
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform  = 'translateY(-2px)';
      e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.18)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform  = 'none';
      e.currentTarget.style.boxShadow  = 'none';
    }}>

      {/* Top row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.6rem', gap: '0.5rem' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', lineHeight: 1.3 }}>{campaign.title}</h3>
        <span style={{
          fontSize: '0.7rem', fontWeight: 700,
          padding: '0.2rem 0.6rem', borderRadius: 99,
          background: meta.bg, color: meta.color,
          textTransform: 'uppercase', letterSpacing: '0.05em',
          whiteSpace: 'nowrap', flexShrink: 0,
        }}>
          {meta.icon} {meta.label}
        </span>
      </div>

      {/* Summary */}
      <p style={{
        fontSize: '0.82rem', color: 'var(--color-text-muted)',
        margin: '0 0 0.9rem', lineHeight: 1.5,
        display: '-webkit-box', WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical', overflow: 'hidden',
      }}>
        {campaign.summary}
      </p>

      {/* Progress bar */}
      <div style={{ height: 5, background: 'var(--color-border)', borderRadius: 99, overflow: 'hidden', marginBottom: '0.5rem' }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: 'linear-gradient(90deg, var(--color-primary), var(--color-accent))',
          borderRadius: 99, transition: 'width 0.5s ease',
        }} />
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.9rem' }}>
        <span><strong style={{ color: 'var(--color-text)' }}>{formatINR(raised)}</strong> / {formatINR(goal)} raised</span>
        <span>{pct}% · {campaign.investorCount ?? 0} investor{(campaign.investorCount ?? 0) !== 1 ? 's' : ''}</span>
      </div>

      {/* Meta strip */}
      <div style={{ display: 'flex', gap: '1rem', fontSize: '0.73rem', color: 'var(--color-text-muted)', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <span>📅 {new Date(campaign.deadline).toLocaleDateString()}</span>
        <span>🏁 {campaign.milestoneCount} milestone{campaign.milestoneCount !== 1 ? 's' : ''}</span>
        {campaign.isContractDeployed && <span style={{ color: 'var(--color-success)' }}>⛓️ Audit Logged</span>}
        {isDraft && !campaign.isContractDeployed && (
          <span style={{ color: 'var(--color-warning)' }}>⚠️ Needs activation</span>
        )}
      </div>

      {/* Tags */}
      {campaign.tags?.length > 0 && (
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          {campaign.tags.map((t) => (
            <span key={t} style={{
              fontSize: '0.68rem', padding: '0.1rem 0.4rem',
              borderRadius: 99, background: 'rgba(99,102,241,0.08)',
              color: 'var(--color-primary)',
            }}>#{t}</span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <Link
          to={`/dashboard/campaigns/${campaign._id}`}
          className="btn btn--primary btn--sm"
        >
          {isDraft ? '⚡ Manage & Activate' : '📊 Manage'}
        </Link>
      </div>
    </div>
  );
}

// ─── Status filter tabs ────────────────────────────────────────────────────────

const FILTER_TABS = ['all', 'draft', 'active', 'paused', 'funded', 'completed', 'cancelled'];

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function MyCampaigns() {
  const [campaigns, setCampaigns] = useState(undefined); // undefined = loading
  const [loadErr,   setLoadErr]   = useState('');
  const [filter,    setFilter]    = useState('all');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await getMyCampaigns();
        if (!cancelled) setCampaigns(data);
      } catch {
        if (!cancelled) setLoadErr('Could not load campaigns.');
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const filtered = !campaigns ? [] :
    filter === 'all' ? campaigns :
    campaigns.filter((c) => c.localStatus === filter);

  const counts = FILTER_TABS.reduce((acc, t) => {
    acc[t] = t === 'all'
      ? (campaigns?.length ?? 0)
      : (campaigns?.filter((c) => c.localStatus === t).length ?? 0);
    return acc;
  }, {});

  return (
    <div className="animate-fade-in">

      {/* Header */}
      <div className="dashboard__header" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h2 style={{ margin: 0 }}>📋 My Campaigns</h2>
            <p className="text-muted text-sm" style={{ marginTop: '0.3rem' }}>
              {campaigns === undefined ? 'Loading…' : `${campaigns.length} campaign${campaigns.length !== 1 ? 's' : ''} total`}
            </p>
          </div>
          <Link to="/dashboard/campaigns/new" className="btn btn--primary btn--sm">
            ＋ New Campaign
          </Link>
        </div>
      </div>

      {/* Filter tabs */}
      {campaigns && campaigns.length > 0 && (
        <div style={{
          display: 'flex', gap: '0.35rem', flexWrap: 'wrap',
          marginBottom: '1.5rem',
          padding: '0.4rem',
          background: 'rgba(99,102,241,0.04)',
          borderRadius: 'var(--r-lg)',
          border: '1px solid var(--color-border)',
        }}>
          {FILTER_TABS.filter((t) => t === 'all' || counts[t] > 0).map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              style={{
                fontSize:     '0.78rem',
                fontWeight:   filter === t ? 700 : 400,
                padding:      '0.3rem 0.75rem',
                borderRadius: 'var(--r-md)',
                border:       'none',
                cursor:       'pointer',
                background:   filter === t ? 'var(--color-primary)' : 'transparent',
                color:        filter === t ? '#fff' : 'var(--color-text-muted)',
                transition:   'all 0.2s ease',
              }}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
              {counts[t] > 0 && (
                <span style={{
                  marginLeft: '0.35rem',
                  fontSize: '0.68rem',
                  background: filter === t ? 'rgba(255,255,255,0.2)' : 'rgba(99,102,241,0.15)',
                  color: filter === t ? '#fff' : 'var(--color-primary)',
                  padding: '0.05rem 0.35rem',
                  borderRadius: 99,
                }}>
                  {counts[t]}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Loading */}
      {campaigns === undefined && !loadErr && (
        <div>
          {[1, 2].map((i) => (
            <div key={i} className="skeleton" style={{ height: 220, marginBottom: '1rem', borderRadius: 'var(--r-lg)' }} />
          ))}
        </div>
      )}

      {/* Error */}
      {loadErr && (
        <div style={{
          padding: '2.5rem', textAlign: 'center',
          background: 'rgba(239,68,68,0.05)',
          border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 'var(--r-lg)',
        }}>
          <span style={{ fontSize: '2rem' }}>⚠️</span>
          <p style={{ color: 'var(--color-error)', marginTop: '0.75rem' }}>{loadErr}</p>
          <button className="btn btn--ghost btn--sm" style={{ marginTop: '0.75rem' }} onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      )}

      {/* Campaign list */}
      {campaigns !== undefined && filtered.map((c) => (
        <CampaignCard key={c._id} campaign={c} />
      ))}

      {/* Empty state — no campaigns at all */}
      {campaigns !== undefined && campaigns.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
          <span style={{ fontSize: '3rem' }}>🚀</span>
          <h3 style={{ margin: '1rem 0 0.5rem' }}>No campaigns yet</h3>
          <p className="text-muted text-sm" style={{ marginBottom: '1.5rem' }}>
            Create your first fundraising campaign to start raising funds securely.
          </p>
          <Link to="/dashboard/campaigns/new" className="btn btn--primary">
            ＋ Create Campaign
          </Link>
        </div>
      )}

      {/* Empty state — nothing matches filter */}
      {campaigns !== undefined && campaigns.length > 0 && filtered.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '2rem 1.5rem' }}>
          <p className="text-muted text-sm">No {filter} campaigns.</p>
          <button
            className="btn btn--ghost btn--sm"
            style={{ marginTop: '0.75rem' }}
            onClick={() => setFilter('all')}
          >
            Show all
          </button>
        </div>
      )}

    </div>
  );
}
