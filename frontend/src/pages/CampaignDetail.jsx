/**
 * src/pages/CampaignDetail.jsx
 *
 * Public campaign detail page — real backend data via React Query.
 *
 * Endpoints:
 *   GET /api/v1/campaigns/:campaignId         (optionalAuth — public)
 *   GET /api/v1/campaigns/:campaignId/milestones (optionalAuth — public)
 *
 * Auth: NOT required to view. Invest CTA gated to logged-in investors only.
 * MetaMask invest flow: InvestModal component with full on-chain + stub support.
 */

import { useState }          from 'react';
import { useParams, Link }   from 'react-router-dom';
import { useQuery }          from '@tanstack/react-query';
import { getCampaign }       from '../api/campaigns.api';
import { getMilestones }     from '../api/milestones.api';
import useAuthStore          from '../store/authStore';
import InvestModal           from '../components/InvestModal';
import {
  fundingPercent,
  daysRemaining,
  formatDate,
  formatINR,
} from '../utils/formatters';

// ─── Status badge class map ────────────────────────────────────────────────────
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

// ─── Milestone status badge ────────────────────────────────────────────────────
function milestoneIcon(status) {
  const map = {
    pending:   { icon: '⏳', cls: 'badge--pending'  },
    submitted: { icon: '📩', cls: 'badge--pending'  },
    approved:  { icon: '✅', cls: 'badge--approved' },
    rejected:  { icon: '❌', cls: 'badge--rejected' },
    disbursed: { icon: '💸', cls: 'badge--active'   },
  };
  return map[status] || { icon: '⏳', cls: 'badge--pending' };
}

// ─── Skeleton block ────────────────────────────────────────────────────────────
function Skel({ w = '100%', h = 16, mt = 0 }) {
  return (
    <div style={{
      width:        w,
      height:       h,
      background:   'var(--color-border)',
      borderRadius: 4,
      marginTop:    mt,
    }} />
  );
}

// ─── Loading skeleton ──────────────────────────────────────────────────────────
function DetailSkeleton() {
  return (
    <div>
      <div className="page-hero">
        <div className="container">
          <Skel w={80}  h={13} />
          <Skel w="50%" h={36} mt={16} />
          <Skel w="70%" h={16} mt={12} />
        </div>
      </div>
      <div className="container" style={{ paddingTop: '2.5rem', paddingBottom: '4rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '2rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="card"><Skel h={120} /></div>
            <div className="card"><Skel h={180} /></div>
          </div>
          <div className="card" style={{ height: 340 }}>
            <Skel h={40} />
            <Skel h={8} mt={12} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '1rem' }}>
              {[0,1,2,3].map(i => <Skel key={i} h={60} />)}
            </div>
            <Skel h={48} mt={16} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function CampaignDetail() {
  const { campaignId }          = useParams();
  const { isLoggedIn, role }    = useAuthStore();
  const [investOpen, setInvestOpen] = useState(false);
  // Optimistically update raised amount after successful invest
  const [extraRaised, setExtraRaised] = useState(0);

  // ── Campaign data ─────────────────────────────────────────────────────────
  const {
    data:      campaign,
    isLoading: loadingCampaign,
    isError:   errorCampaign,
    error:     campaignErr,
  } = useQuery({
    queryKey: ['campaign', campaignId],
    queryFn:  () => getCampaign(campaignId),
    enabled:  !!campaignId,
    staleTime: 1000 * 60 * 2,
  });

  // ── Milestones ────────────────────────────────────────────────────────────
  const {
    data:      milestones = [],
    isLoading: loadingMilestones,
  } = useQuery({
    queryKey: ['milestones', campaignId],
    queryFn:  () => getMilestones(campaignId),
    enabled:  !!campaignId && !!campaign,
    staleTime: 1000 * 60 * 2,
  });

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loadingCampaign) return <DetailSkeleton />;

  // ── Error ─────────────────────────────────────────────────────────────────
  if (errorCampaign) {
    return (
      <div className="container" style={{ paddingTop: '4rem', paddingBottom: '4rem' }}>
        <div className="empty-state">
          <span className="empty-state__emoji">⚠️</span>
          <p className="empty-state__title">Campaign not found</p>
          <p className="text-muted text-sm">
            {campaignErr?.response?.data?.message || 'Could not load this campaign.'}
          </p>
          <Link to="/discover" className="btn btn--primary" style={{ marginTop: '1.5rem' }}>
            Back to Discover
          </Link>
        </div>
      </div>
    );
  }

  // ── Derived values ────────────────────────────────────────────────────────
  const startup  = campaign.startupProfileId;
  const raised   = (campaign.currentRaised ?? 0) + extraRaised;
  const pct      = fundingPercent(raised, campaign.fundingGoal);
  const days     = daysRemaining(campaign.deadline);
  const isClosed = ['completed', 'cancelled'].includes(campaign.status);
  const canInvest = campaign.status === 'active' && !isClosed && isLoggedIn && role === 'investor';

  const handleInvestSuccess = ({ investment }) => {
    setInvestOpen(false);
    setExtraRaised((prev) => prev + (investment?.amount ?? 0));
  };

  return (
    <div>

      {/* ── Page hero ────────────────────────────────────────────────────── */}
      <div className="page-hero">
        <div className="container">
          <div className="flex items-center gap-3 mb-4">
            <Link to="/discover" className="text-muted text-sm">← Back to Discover</Link>
          </div>
          <div className="flex items-center gap-3 mb-3" style={{ flexWrap: 'wrap' }}>
            <span className={`badge ${statusBadge(campaign.status)}`}>{campaign.status}</span>
            {startup?.industry && <span className="text-muted text-sm">{startup.industry}</span>}
            {startup?.isVerified && <span className="text-xs" style={{ color: 'var(--color-success)' }}>✅ Verified Startup</span>}
            {campaign.isContractDeployed && (
              <span className="text-xs" style={{ color: 'var(--color-accent)' }}>⛓️ Audit Recorded</span>
            )}
          </div>
          <h1 style={{ marginBottom: '0.5rem' }}>{campaign.title}</h1>
          {startup?.startupName && (
            <p className="text-muted text-sm" style={{ marginBottom: '0.5rem' }}>
              by <strong style={{ color: 'var(--color-text)' }}>{startup.startupName}</strong>
              {startup.tagline && ` · ${startup.tagline}`}
            </p>
          )}
          <p style={{ maxWidth: 640 }}>{campaign.summary}</p>

          {/* Tags */}
          {campaign.tags?.length > 0 && (
            <div className="flex gap-2 flex-wrap mt-4">
              {campaign.tags.map((t) => (
                <span key={t} className="badge badge--draft" style={{ fontSize: '0.75rem' }}>#{t}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="container" style={{ paddingTop: '2.5rem', paddingBottom: '4rem' }}>
        <div style={{
          display:             'grid',
          gridTemplateColumns: 'minmax(0,1fr) 360px',
          gap:                 '2rem',
          alignItems:          'start',
        }}>

          {/* ── Left column ──────────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            {/* About */}
            <div className="card">
              <h3 style={{ marginBottom: '1rem' }}>About this Campaign</h3>
              <p style={{ lineHeight: 1.8, maxWidth: 'none', whiteSpace: 'pre-wrap' }}>
                {campaign.summary}
              </p>
              {campaign.description && (
                <p style={{ lineHeight: 1.8, maxWidth: 'none', marginTop: '1rem', whiteSpace: 'pre-wrap' }}>
                  {campaign.description}
                </p>
              )}

              {/* Campaign meta grid */}
              <div style={{
                display:             'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
                gap:                 '0.75rem',
                marginTop:           '1.5rem',
              }}>
                {[
                  { label: 'Funding Goal',      value: `${campaign.fundingGoal?.toLocaleString()} INR` },
                  { label: 'Min Investment',     value: campaign.minInvestment ? `${campaign.minInvestment} INR` : '—' },
                  { label: 'Milestones',         value: campaign.milestoneCount },
                  { label: 'Deadline',           value: formatDate(campaign.deadline) },
                  { label: 'Current Milestone',  value: `#${(campaign.currentMilestoneIndex ?? 0) + 1}` },
                  { label: 'Currency',           value: campaign.currency ?? 'INR' },
                ].map((item) => (
                  <div key={item.label} style={{
                    padding:      '0.875rem 1rem',
                    background:   'var(--color-surface)',
                    borderRadius: 'var(--r-md)',
                    border:       '1px solid var(--color-border)',
                  }}>
                    <div className="text-xs text-muted">{item.label}</div>
                    <div className="font-semibold text-sm mt-1">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Milestone roadmap */}
            <div className="card">
              <h3 style={{ marginBottom: '1.5rem' }}>📍 Milestone Roadmap</h3>
              {loadingMilestones ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {Array.from({ length: campaign.milestoneCount || 2 }).map((_, i) => (
                    <Skel key={i} h={70} />
                  ))}
                </div>
              ) : milestones.length === 0 ? (
                <p className="text-muted text-sm">No milestones defined yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {milestones.map((m, idx) => {
                    const ms    = milestoneIcon(m.status);
                    const isCur = idx === (campaign.currentMilestoneIndex ?? 0);
                    return (
                      <div
                        key={m._id ?? m.index ?? idx}
                        style={{
                          display:      'flex',
                          gap:          '1rem',
                          alignItems:   'flex-start',
                          padding:      '1rem 1.25rem',
                          background:   isCur ? 'rgba(139,92,246,0.07)' : 'var(--color-surface)',
                          borderRadius: 'var(--r-md)',
                          border:       `1px solid ${isCur ? 'var(--color-primary)' : 'var(--color-border)'}`,
                        }}
                      >
                        {/* Index bubble */}
                        <div style={{
                          width:           32,
                          height:          32,
                          borderRadius:    '50%',
                          background:      isCur ? 'var(--color-primary)' : 'var(--color-border)',
                          color:           isCur ? '#fff' : 'var(--color-text-muted)',
                          display:         'flex',
                          alignItems:      'center',
                          justifyContent:  'center',
                          fontSize:        '0.8rem',
                          fontWeight:      700,
                          flexShrink:      0,
                        }}>
                          {idx + 1}
                        </div>

                        {/* Content */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="flex items-center gap-2" style={{ marginBottom: '0.3rem' }}>
                            <span className="font-semibold text-sm">{m.title}</span>
                            {isCur && (
                              <span className="badge badge--active" style={{ fontSize: '0.65rem', padding: '1px 6px' }}>
                                Current
                              </span>
                            )}
                          </div>
                          {m.description && (
                            <p className="text-muted text-xs" style={{ marginBottom: '0.5rem' }}>
                              {m.description}
                            </p>
                          )}
                          <div className="flex items-center gap-3">
                            <span className={`badge ${ms.cls}`} style={{ fontSize: '0.7rem' }}>
                              {ms.icon} {m.status}
                            </span>
                            <span className="text-muted text-xs">
                              {m.percentage}% · ≈ {((m.percentage / 100) * campaign.fundingGoal).toLocaleString()} INR
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Startup profile highlights */}
            {startup && (
              <div className="card">
                <h3 style={{ marginBottom: '1.25rem' }}>🚀 About the Startup</h3>
                <div className="flex items-center gap-3 mb-4">
                  <div style={{
                    width:           48,
                    height:          48,
                    borderRadius:    'var(--r-md)',
                    background:      'linear-gradient(135deg,var(--color-primary),var(--color-accent))',
                    display:         'flex',
                    alignItems:      'center',
                    justifyContent:  'center',
                    fontSize:        '1.25rem',
                    color:           '#fff',
                    fontWeight:      700,
                    flexShrink:      0,
                  }}>
                    {(startup.startupName || '?').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-semibold">
                      {startup.startupName}
                      {startup.isVerified && ' ✅'}
                    </div>
                    {startup.tagline && (
                      <div className="text-muted text-sm">{startup.tagline}</div>
                    )}
                    {startup.industry && (
                      <div className="text-muted text-xs">{startup.industry}</div>
                    )}
                  </div>
                </div>

                {/* Social / website links */}
                {(startup.website || startup.socialLinks) && (
                  <div className="flex gap-3 flex-wrap">
                    {startup.website && (
                      <a
                        href={startup.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn--ghost btn--sm"
                      >
                        🌐 Website
                      </a>
                    )}
                    {startup.socialLinks?.linkedin && (
                      <a
                        href={startup.socialLinks.linkedin}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn--ghost btn--sm"
                      >
                        💼 LinkedIn
                      </a>
                    )}
                    {startup.socialLinks?.twitter && (
                      <a
                        href={startup.socialLinks.twitter}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn--ghost btn--sm"
                      >
                        🐦 Twitter
                      </a>
                    )}
                    {startup.socialLinks?.github && (
                      <a
                        href={startup.socialLinks.github}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn--ghost btn--sm"
                      >
                        🐙 GitHub
                      </a>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* On-chain info (if deployed) */}
            {campaign.isContractDeployed && campaign.contractAddress && (
              <div className="card" style={{ border: '1px solid var(--color-accent)' }}>
                <h3 style={{ marginBottom: '1rem' }}>⛓️ Transparency Registry (Audit)</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div>
                    <div className="text-xs text-muted">Contract Address</div>
                    <code style={{ fontSize: '0.8rem', wordBreak: 'break-all' }}>
                      {campaign.contractAddress}
                    </code>
                  </div>
                  <a
                    href={`https://amoy.polygonscan.com/address/${campaign.contractAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn--ghost btn--sm"
                    style={{ alignSelf: 'flex-start' }}
                  >
                    View on PolygonScan ↗
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* ── Right column: sticky invest panel ────────────────────────── */}
          <div style={{ position: 'sticky', top: 'calc(var(--navbar-height, 64px) + 1.5rem)' }}>
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

              {/* Funding progress */}
              <div>
                <div className="flex justify-between mb-2">
                  <span className="font-bold" style={{ fontSize: '1.5rem' }}>
                    {raised.toLocaleString()} INR
                  </span>
                  <span className="text-muted text-sm">raised</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-bar__fill" style={{ width: `${pct}%` }} />
                </div>
                <div className="flex justify-between mt-2">
                  <span className="font-semibold text-sm">{pct}% of {campaign.fundingGoal?.toLocaleString()} INR</span>
                </div>
              </div>

              {/* Stats grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                {[
                  { label: 'Investors',  value: campaign.investorCount ?? 0 },
                  { label: 'Days left',  value: days === 0 ? 'Ended' : `${days}d` },
                  { label: 'Min invest', value: campaign.minInvestment ? `${campaign.minInvestment} INR` : '—' },
                  { label: 'Deadline',   value: formatDate(campaign.deadline) },
                ].map((s) => (
                  <div key={s.label} style={{
                    background:   'var(--color-surface)',
                    borderRadius: 'var(--r-md)',
                    padding:      '0.875rem',
                    border:       '1px solid var(--color-border)',
                  }}>
                    <div className="text-xs text-muted">{s.label}</div>
                    <div className="font-semibold text-sm mt-1">{s.value}</div>
                  </div>
                ))}
              </div>

              {/* ── Invest CTA area ─────────────────────────────────────── */}
              {isClosed ? (
                <div style={{ textAlign: 'center', padding: '0.5rem' }}>
                  <span className={`badge ${statusBadge(campaign.status)}`} style={{ fontSize: '0.85rem', padding: '6px 14px' }}>
                    Campaign {campaign.status}
                  </span>
                  <p className="text-muted text-xs mt-3">This campaign is no longer accepting investments.</p>
                </div>
              ) : !isLoggedIn ? (
                <div style={{ textAlign: 'center' }}>
                  <p className="text-muted text-sm mb-4">Sign in to invest in this campaign.</p>
                  <Link to="/login" className="btn btn--primary" style={{ display: 'block', textAlign: 'center' }}>
                    Log in to Invest
                  </Link>
                </div>
              ) : role !== 'investor' ? (
                <div style={{ textAlign: 'center', padding: '0.5rem' }}>
                  <p className="text-muted text-sm">Only investor accounts can fund campaigns.</p>
                  {role === 'startup' && (
                    <p className="text-muted text-xs mt-2">You're signed in as a startup. Switch to an investor account to invest.</p>
                  )}
                </div>
              ) : campaign.status !== 'active' ? (
                <div style={{ textAlign: 'center', padding: '0.5rem' }}>
                  <p className="text-muted text-sm">
                    This campaign is <strong>{campaign.status}</strong> and not accepting investments.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {/* Invest button → opens modal */}
                  <button
                    id="invest-open-modal-btn"
                    className="btn btn--primary"
                    style={{ width: '100%', padding: '14px', fontSize: '1rem', justifyContent: 'center', background: 'var(--color-accent)', color: '#fff' }}
                    onClick={() => setInvestOpen(true)}
                  >
                    Invest via Razorpay
                  </button>
                  <p className="text-muted text-xs" style={{ textAlign: 'center', margin: 0 }}>
                    Secure payments via Razorpay
                  </p>
                </div>
              )}

              {/* ── InvestModal portal ──────────────────────────────────────── */}
              <InvestModal
                isOpen={investOpen}
                onClose={() => setInvestOpen(false)}
                campaign={campaign}
                onSuccess={handleInvestSuccess}
              />


              {/* On-chain status footer */}
              <div style={{ textAlign: 'center', paddingTop: '0.25rem', borderTop: '1px solid var(--color-border)' }}>
                <span className="text-xs text-muted">
                  {campaign.isContractDeployed
                    ? '✅ Audit entry recorded on Polygon Amoy'
                    : '⏳ Awaiting transparency recording'}
                </span>
              </div>
            </div>

            {/* Share / watch placeholder */}
            <div style={{
              marginTop:    '1rem',
              padding:      '1rem',
              textAlign:    'center',
              color:        'var(--color-text-muted)',
              fontSize:     '0.8rem',
            }}>
              🔖 Bookmark and share features coming soon
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
