/**
 * src/pages/Discover.jsx
 *
 * Public campaign discovery — real backend data via React Query.
 *
 * Backend: GET /api/v1/campaigns  (optionalAuth — no JWT required)
 *   Query params: status (default 'active'), search, sortBy, page, limit
 *   Response:     { data: { campaigns[] }, meta: { total, page, pages } }
 *
 * Auth: NOT required. The backend uses optionalAuth so anonymous visitors
 * can browse campaigns without logging in.
 *
 * Note: the backend uses $text search — a text index must exist on the Campaign
 * model for ?search= to work. Without it the backend falls back to the full
 * set (status filter still applies).
 */

import { useState, useCallback } from 'react';
import { Link, useNavigate }     from 'react-router-dom';
import { useQuery }              from '@tanstack/react-query';
import { listCampaigns }         from '../api/campaigns.api';
import { fundingPercent, daysRemaining, formatDate } from '../utils/formatters';

// ─── Status-badge helper ──────────────────────────────────────────────────────
function statusBadge(status) {
  const map = {
    active:    'badge--active',
    funded:    'badge--approved',
    paused:    'badge--pending',
    draft:     'badge--draft',
    cancelled: 'badge--rejected',
    completed: 'badge--approved',
  };
  return map[status] || 'badge--pending';
}

// ─── Sort options supported by backend ────────────────────────────────────────
const SORT_OPTIONS = [
  { value: 'newest',   label: 'Newest' },
  { value: 'deadline', label: 'Ending Soon' },
  { value: 'raised',   label: 'Most Funded' },
  { value: 'goal',     label: 'Largest Goal' },
];

// ─── Single card ──────────────────────────────────────────────────────────────
function CampaignCard({ campaign }) {
  const pct     = fundingPercent(campaign.currentRaised, campaign.fundingGoal);
  const days    = daysRemaining(campaign.deadline);
  const startup = campaign.startupProfileId;

  return (
    <Link to={`/campaigns/${campaign._id}`} style={{ textDecoration: 'none' }}>
      <div className="campaign-card card--glow campaign-card--hover" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div className="campaign-card__body" style={{ flex: 1 }}>

          {/* Status row */}
          <div className="flex items-center justify-between mb-4">
            <span className={`badge ${statusBadge(campaign.status)}`}>
              {campaign.status}
            </span>
            <span className="text-muted text-xs">
              {startup?.industry || '—'} · {campaign.milestoneCount} milestones
            </span>
          </div>

          {/* Title + startup */}
          <h3 className="campaign-card__title">{campaign.title}</h3>
          {startup?.startupName && (
            <p className="text-muted text-xs mb-2" style={{ marginTop: '-0.25rem' }}>
              by {startup.startupName}
              {startup.isVerified && ' ✅'}
            </p>
          )}
          <p className="campaign-card__desc">{campaign.summary}</p>

          {/* Tags */}
          {campaign.tags?.length > 0 && (
            <div className="flex gap-2 flex-wrap mt-3">
              {campaign.tags.slice(0, 3).map((t) => (
                <span key={t} className="badge badge--draft" style={{ fontSize: '0.7rem', padding: '2px 8px' }}>
                  #{t}
                </span>
              ))}
            </div>
          )}

          {/* Progress */}
          <div className="progress-bar mt-4">
            <div className="progress-bar__fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-sm font-semibold">{pct}% funded</span>
            <span className="text-muted text-xs">
              {(campaign.currentRaised ?? 0).toLocaleString()} / {campaign.fundingGoal.toLocaleString()} INR
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="campaign-card__footer">
          <div className="flex justify-between text-sm">
            <span className="text-muted">👥 {campaign.investorCount ?? 0} investors</span>
            <span
              style={{ color: days <= 7 ? 'var(--color-warning)' : undefined }}
              className={days <= 7 ? 'text-sm font-semibold' : 'text-muted text-sm'}
            >
              {days === 0 ? '⌛ Deadline passed' : `⏰ ${days}d left`}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ─── Skeleton card ────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="card" style={{ height: 260 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ height: 18, width: 60,  background: 'var(--color-border)', borderRadius: 4 }} />
        <div style={{ height: 22, width: '70%', background: 'var(--color-border)', borderRadius: 4 }} />
        <div style={{ height: 14, width: '90%', background: 'var(--color-border)', borderRadius: 4 }} />
        <div style={{ height: 14, width: '60%', background: 'var(--color-border)', borderRadius: 4 }} />
        <div style={{ height: 8,  width: '100%', background: 'var(--color-border)', borderRadius: 4, marginTop: '0.5rem' }} />
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Discover() {
  const [search,  setSearch]  = useState('');
  const [sortBy,  setSortBy]  = useState('newest');
  const [draftSearch, setDraftSearch] = useState(''); // debounced input value
  const navigate = useNavigate();

  // Debounce: only fire search query after user stops typing
  const [searchTimer, setSearchTimer] = useState(null);
  const handleSearchChange = useCallback((e) => {
    const val = e.target.value;
    setDraftSearch(val);
    if (searchTimer) clearTimeout(searchTimer);
    const t = setTimeout(() => setSearch(val), 500);
    setSearchTimer(t);
  }, [searchTimer]);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['campaigns', 'discover', search, sortBy],
    queryFn:  () => listCampaigns({
      status: 'active',
      search: search || undefined,
      sortBy,
      limit:  24,
    }),
    staleTime: 1000 * 60,
  });

  const campaigns = data?.campaigns ?? [];
  const meta      = data?.meta ?? {};

  return (
    <div>
      {/* Page header */}
      <div className="page-hero">
        <div className="container">
          <h1 style={{ marginBottom: '0.5rem' }}>🔍 Discover Campaigns</h1>
          <p>Blockchain-verified startup campaigns seeking investment on Polygon Amoy.</p>
        </div>
      </div>

      <div className="container" style={{ paddingTop: '2.5rem', paddingBottom: '4rem' }}>

        {/* ── Controls bar ───────────────────────────────────────────── */}
        <div
          className="flex"
          style={{
            gap:            '1rem',
            marginBottom:   '2rem',
            flexWrap:       'wrap',
            alignItems:     'center',
          }}
        >
          {/* Search */}
          <input
            type="text"
            className="form-input"
            placeholder="Search campaigns..."
            value={draftSearch}
            onChange={handleSearchChange}
            style={{ flex: '1 1 260px', minWidth: 0 }}
          />

          {/* Sort */}
          <select
            className="form-input"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{ width: 'auto', flexShrink: 0 }}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {/* Result count */}
          {!isLoading && (
            <span className="text-muted text-sm" style={{ flexShrink: 0 }}>
              {isError ? '' : `${meta.total ?? campaigns.length} campaign${(meta.total ?? campaigns.length) !== 1 ? 's' : ''}`}
            </span>
          )}
        </div>

        {/* ── States ─────────────────────────────────────────────────── */}

        {isLoading && (
          <div className="campaigns-grid">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {isError && !isLoading && (
          <div className="empty-state">
            <span className="empty-state__emoji">⚠️</span>
            <p className="empty-state__title">Failed to load campaigns</p>
            <p className="text-muted text-sm" style={{ maxWidth: 380, textAlign: 'center' }}>
              {error?.response?.data?.message || error?.message || 'Could not reach the server.'}
            </p>
          </div>
        )}

        {!isLoading && !isError && campaigns.length === 0 && (
          <div className="empty-state">
            <span className="empty-state__emoji">🔭</span>
            <p className="empty-state__title">
              {search ? 'No campaigns match your search.' : 'No active campaigns yet.'}
            </p>
            {search && (
              <button
                className="btn btn--ghost btn--sm"
                onClick={() => { setSearch(''); setDraftSearch(''); }}
                style={{ marginTop: '1rem' }}
              >
                Clear search
              </button>
            )}
          </div>
        )}

        {!isLoading && !isError && campaigns.length > 0 && (
          <div className="campaigns-grid">
            {campaigns.map((c) => (
              <CampaignCard key={c._id} campaign={c} />
            ))}
          </div>
        )}

        {/* Pagination hint (simple — backend supports pages) */}
        {meta.pages > 1 && (
          <p className="text-muted text-sm" style={{ textAlign: 'center', marginTop: '2rem' }}>
            Showing page {meta.page} of {meta.pages}. Refine your search to narrow results.
          </p>
        )}
      </div>
    </div>
  );
}
