/**
 * src/pages/Discover.jsx
 *
 * Public campaign discovery — real backend data via React Query.
 * Includes dynamic filters for sector, risk score, funding stage, return potential,
 * and milestone progress.
 */

import { useState, useCallback } from 'react';
import { Link }                  from 'react-router-dom';
import { useQuery }              from '@tanstack/react-query';
import { listCampaigns }         from '../api/campaigns.api';
import { fundingPercent, daysRemaining } from '../utils/formatters';

// ─── Constants ────────────────────────────────────────────────────────────────
const SORT_OPTIONS = [
  { value: 'newest',   label: 'Newest' },
  { value: 'deadline', label: 'Ending Soon' },
  { value: 'raised',   label: 'Most Funded' },
  { value: 'goal',     label: 'Largest Goal' },
  { value: 'highest_return', label: 'Highest Return' },
];

const SECTORS = ['DeFi', 'Gaming', 'AI', 'Infrastructure', 'Social', 'Consumer', 'Other'];
const STAGES = ['pre-seed', 'seed', 'series-a', 'series-b', 'series-c', 'growth'];

// ─── Helpers ──────────────────────────────────────────────────────────────────
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

function riskBadge(score) {
  if (!score) return { class: 'badge--draft', label: 'Unknown Risk' };
  if (score <= 3) return { class: 'badge--success', label: 'Low Risk' };
  if (score <= 7) return { class: 'badge--pending', label: 'Medium Risk' };
  return { class: 'badge--rejected', label: 'High Risk' };
}

function returnBadgeClass(rp) {
  const map = {
    low: 'badge--draft',
    medium: 'badge--active',
    high: 'badge--success',
    moonshot: 'badge--warning'
  };
  return map[rp] || 'badge--draft';
}

// ─── Single card ──────────────────────────────────────────────────────────────
function CampaignCard({ campaign }) {
  const pct     = fundingPercent(campaign.currentRaised, campaign.fundingGoal);
  const days    = daysRemaining(campaign.deadline);
  const startup = campaign.startupProfileId;
  const risk    = riskBadge(campaign.riskScore);

  return (
    <Link to={`/campaigns/${campaign._id}`} style={{ textDecoration: 'none' }}>
      <div className="campaign-card card--glow campaign-card--hover" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div className="campaign-card__body" style={{ flex: 1 }}>

          {/* Status & Risk row */}
          <div className="flex items-center justify-between mb-4">
            <span className={`badge ${statusBadge(campaign.status)}`}>
              {campaign.status}
            </span>
            {campaign.riskScore && (
              <span className={`badge ${risk.class}`} title={`Risk Score: ${campaign.riskScore}/10`}>
                {risk.label}
              </span>
            )}
          </div>

          {/* Title + startup */}
          <h3 className="campaign-card__title" style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>{campaign.title}</h3>
          
          {/* Metadata Row: Sector & Stage */}
          <div className="flex items-center gap-2 mb-3 text-xs text-muted font-medium">
             {campaign.sector && <span>{campaign.sector}</span>}
             {campaign.sector && campaign.fundingStage && <span>·</span>}
             {campaign.fundingStage && <span style={{ textTransform: 'capitalize' }}>{campaign.fundingStage.replace('-', ' ')}</span>}
          </div>

          {startup?.startupName && (
            <p className="text-muted text-xs mb-3 flex items-center gap-1">
              by <span className="font-semibold" style={{ color: 'var(--color-text)' }}>{startup.startupName}</span>
              {startup.isVerified && ' ✅'}
            </p>
          )}

          <p className="campaign-card__desc" style={{ WebkitLineClamp: 2 }}>{campaign.summary}</p>

          {/* Return Potential Indicator */}
          {campaign.returnPotential && (
            <div className="mt-3">
              <span className={`badge ${returnBadgeClass(campaign.returnPotential)}`} style={{ fontSize: '0.7rem', textTransform: 'uppercase' }}>
                {campaign.returnPotential} Return
              </span>
            </div>
          )}

          {/* Progress */}
          <div className="progress-bar mt-4">
            <div className="progress-bar__fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-sm font-semibold text-gradient">{pct}% funded</span>
            <span className="text-muted text-xs font-mono">
              {(campaign.currentRaised ?? 0).toLocaleString()} / {campaign.fundingGoal.toLocaleString()} {campaign.currency}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="campaign-card__footer" style={{ borderTop: '1px solid var(--color-border)', marginTop: 'auto', paddingTop: '1rem' }}>
          <div className="flex justify-between text-sm items-center">
            <span className="text-muted flex items-center gap-1">👥 {campaign.investorCount ?? 0} backers</span>
            <span
              style={{ color: days <= 7 ? 'var(--color-warning)' : undefined }}
              className={days <= 7 ? 'text-sm font-semibold flex items-center gap-1' : 'text-muted text-sm flex items-center gap-1'}
            >
              {days === 0 ? '⌛ Ended' : `⏰ ${days}d left`}
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
    <div className="card" style={{ height: 320, padding: '1.5rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div className="flex justify-between">
           <div style={{ height: 22, width: 60,  background: 'var(--color-border)', borderRadius: 4 }} />
           <div style={{ height: 22, width: 60,  background: 'var(--color-border)', borderRadius: 4 }} />
        </div>
        <div style={{ height: 24, width: '80%', background: 'var(--color-border)', borderRadius: 4, margin: '0.5rem 0' }} />
        <div style={{ height: 16, width: '40%', background: 'var(--color-border)', borderRadius: 4 }} />
        <div style={{ height: 14, width: '90%', background: 'var(--color-border)', borderRadius: 4, marginTop: '0.5rem' }} />
        <div style={{ height: 14, width: '70%', background: 'var(--color-border)', borderRadius: 4 }} />
        <div style={{ height: 8,  width: '100%', background: 'var(--color-border)', borderRadius: 4, marginTop: '1.5rem' }} />
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Discover() {
  const [search,  setSearch]  = useState('');
  const [draftSearch, setDraftSearch] = useState('');
  
  // Filtering States
  const [filters, setFilters] = useState({
    sortBy: 'newest',
    sector: '',
    fundingStage: '',
    riskScore: '',
    returnPotential: '',
    milestoneProgress: ''
  });

  // Debounce search
  const [searchTimer, setSearchTimer] = useState(null);
  const handleSearchChange = useCallback((e) => {
    const val = e.target.value;
    setDraftSearch(val);
    if (searchTimer) clearTimeout(searchTimer);
    const t = setTimeout(() => setSearch(val), 500);
    setSearchTimer(t);
  }, [searchTimer]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      sortBy: 'newest',
      sector: '',
      fundingStage: '',
      riskScore: '',
      returnPotential: '',
      milestoneProgress: ''
    });
    setSearch('');
    setDraftSearch('');
  };

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['campaigns', 'discover', search, filters],
    queryFn:  () => {
      const payload = {
        status: 'active',
        search: search || undefined,
        limit:  24,
        ...filters
      };
      
      // Clean up empty fields
      Object.keys(payload).forEach(key => {
        if (payload[key] === '') delete payload[key];
      });

      return listCampaigns(payload);
    },
    staleTime: 1000 * 60,
  });

  const campaigns = data?.campaigns ?? [];
  const meta      = data?.meta ?? {};

  const activeFilterCount = Object.values(filters).filter(v => v !== '' && v !== 'newest').length + (search ? 1 : 0);

  return (
    <div>
      {/* Page header */}
      <div className="page-hero" style={{ padding: '4rem 1rem', background: 'radial-gradient(circle at 50% 0%, var(--color-surface-hover) 0%, var(--color-bg) 100%)' }}>
        <div className="container" style={{ textAlign: 'center' }}>
          <h1 className="text-gradient" style={{ marginBottom: '1rem', fontSize: '3rem' }}>Discover Campaigns</h1>
          <p className="text-muted" style={{ maxWidth: '600px', margin: '0 auto', fontSize: '1.1rem' }}>
            Explore verified web3 startups, filter by your risk appetite, and invest early in the next generation of decentralized innovation.
          </p>
        </div>
      </div>

      <div className="container" style={{ paddingTop: '2.5rem', paddingBottom: '4rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(250px, 280px) 1fr', gap: '2rem', alignItems: 'start' }}>
          
          {/* ── Sidebar Filters ───────────────────────────────────────────── */}
          <aside className="card card--glow" style={{ position: 'sticky', top: '80px', padding: '1.5rem', zIndex: 10 }}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-semibold" style={{ fontSize: '1.1rem' }}>Filters</h3>
              {activeFilterCount > 0 && (
                <button className="btn btn--ghost text-xs" style={{ padding: '4px 8px' }} onClick={clearFilters}>
                  Clear ({activeFilterCount})
                </button>
              )}
            </div>

            <div className="form-group mb-5">
              <label className="form-label text-sm text-muted">Search</label>
              <input
                type="text"
                className="form-input"
                placeholder="Keywords..."
                value={draftSearch}
                onChange={handleSearchChange}
              />
            </div>

            <div className="form-group mb-5">
              <label className="form-label text-sm text-muted">Sort By</label>
              <select
                className="form-input form-select"
                value={filters.sortBy}
                onChange={(e) => handleFilterChange('sortBy', e.target.value)}
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group mb-5">
              <label className="form-label text-sm text-muted">Sector</label>
              <select
                className="form-input form-select"
                value={filters.sector}
                onChange={(e) => handleFilterChange('sector', e.target.value)}
              >
                <option value="">All Sectors</option>
                {SECTORS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className="form-group mb-5">
              <label className="form-label text-sm text-muted">Funding Stage</label>
              <select
                className="form-input form-select"
                value={filters.fundingStage}
                onChange={(e) => handleFilterChange('fundingStage', e.target.value)}
              >
                <option value="">All Stages</option>
                {STAGES.map((s) => (
                  <option key={s} value={s}>{s.replace('-', ' ')}</option>
                ))}
              </select>
            </div>

            <div className="form-group mb-5">
              <label className="form-label text-sm text-muted">Risk Profile</label>
              <select
                className="form-input form-select"
                value={filters.riskScore}
                onChange={(e) => handleFilterChange('riskScore', e.target.value)}
              >
                <option value="">Any Risk</option>
                <option value="1-3">Low Risk (1-3)</option>
                <option value="4-7">Medium Risk (4-7)</option>
                <option value="8-10">High Risk (8-10)</option>
              </select>
            </div>

            <div className="form-group mb-5">
              <label className="form-label text-sm text-muted">Return Potential</label>
              <select
                className="form-input form-select"
                value={filters.returnPotential}
                onChange={(e) => handleFilterChange('returnPotential', e.target.value)}
              >
                <option value="">Any Return</option>
                <option value="low">Low Return</option>
                <option value="medium">Medium</option>
                <option value="high">High Return</option>
                <option value="moonshot">Moonshot</option>
              </select>
            </div>

            <div className="form-group mb-2">
              <label className="form-label text-sm text-muted">Milestone Progress</label>
              <select
                className="form-input form-select"
                value={filters.milestoneProgress}
                onChange={(e) => handleFilterChange('milestoneProgress', e.target.value)}
              >
                <option value="">Any Progress</option>
                <option value="0">Just Started (0%+)</option>
                <option value="25">Making Progress (25%+)</option>
                <option value="50">Halfway There (50%+)</option>
                <option value="75">Nearing Completion (75%+)</option>
              </select>
            </div>

          </aside>

          {/* ── Main Content Area ────────────────────────────────────────── */}
          <main>
            {/* Header / Stats */}
            <div className="flex justify-between items-center mb-6" style={{ minHeight: '36px' }}>
              <h2 className="font-semibold" style={{ fontSize: '1.25rem' }}>
                {!isLoading && !isError && `${meta.total ?? campaigns.length} Campaign${(meta.total ?? campaigns.length) !== 1 ? 's' : ''} Found`}
                {isLoading && 'Searching campaigns...'}
              </h2>
            </div>
            
            {/* States */}
            {isLoading && (
              <div className="campaigns-grid">
                {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
              </div>
            )}

            {isError && !isLoading && (
              <div className="empty-state card card--glow">
                <span className="empty-state__emoji">⚠️</span>
                <p className="empty-state__title">Failed to load campaigns</p>
                <p className="text-muted text-sm" style={{ maxWidth: 380, margin: '0 auto' }}>
                  {error?.response?.data?.message || error?.message || 'Could not reach the server.'}
                </p>
              </div>
            )}

            {!isLoading && !isError && campaigns.length === 0 && (
              <div className="empty-state card card--glow" style={{ padding: '4rem 2rem' }}>
                <span className="empty-state__emoji" style={{ fontSize: '3rem' }}>🔭</span>
                <p className="empty-state__title" style={{ marginTop: '1rem' }}>
                  {activeFilterCount > 0 ? 'No campaigns match your filters.' : 'No active campaigns yet.'}
                </p>
                {activeFilterCount > 0 && (
                  <button
                    className="btn btn--primary"
                    onClick={clearFilters}
                    style={{ marginTop: '1.5rem' }}
                  >
                    Clear All Filters
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

            {/* Pagination hint */}
            {meta.pages > 1 && (
              <div style={{ textAlign: 'center', marginTop: '3rem', paddingTop: '2rem', borderTop: '1px solid var(--color-border)' }}>
                <p className="text-muted text-sm">
                  Showing page <strong style={{ color: 'var(--color-text)' }}>{meta.page}</strong> of <strong style={{ color: 'var(--color-text)' }}>{meta.pages}</strong>
                </p>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
