/**
 * src/pages/dashboard/InvestorDashboard.jsx
 * Investor overview dashboard.
 * Scaffold: stats row + empty investments section.
 * Full API integration (React Query) added next phase.
 */

import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import useAuthStore from '../../store/authStore';
import { getInvestorDashboard } from '../../api/investor.api';
import { formatINR } from '../../utils/formatters';

const POLYGONSCAN_URL = import.meta.env.VITE_POLYGONSCAN_URL || 'https://amoy.polygonscan.com/tx';

export default function InvestorDashboard() {
  const { user } = useAuthStore();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['investorDashboard'],
    queryFn: getInvestorDashboard,
  });

  const investments       = data?.recentInvestments || [];
  const totalInvested     = data?.totalInvested     || 0;
  const numberOfCampaigns = data?.numberOfCampaigns || 0;
  const activeInvestments = data?.activeInvestments || 0;

  const stats = [
    { emoji: '💰', value: formatINR(totalInvested),     label: 'Total Invested'    },
    { emoji: '📈', value: `${numberOfCampaigns}`,       label: 'Unique Campaigns'  },
    { emoji: '💡', value: `${activeInvestments}`,       label: 'Active Investments' },
  ];

  return (
    <div className="animate-fade-in">

      {/* Header */}
      <div className="dashboard__header">
        <h2>👋 Welcome back, {user?.fullName?.split(' ')[0] || 'Investor'}</h2>
        <p className="text-muted text-sm" style={{ marginTop: '0.35rem' }}>
          Your investment portfolio — tracked and transparent.
        </p>
      </div>

      {/* Stats */}
      <div className="stats-row">
        {stats.map((s) => (
          <div className="stat-card" key={s.label}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{s.emoji}</div>
            <div className="stat-card__value">
              {isLoading ? <div className="skeleton" style={{ height: '24px', width: '60px', margin: '0 auto' }} /> : s.value}
            </div>
            <div className="stat-card__label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Recent investments */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="flex justify-between items-center" style={{ marginBottom: '1.25rem' }}>
          <h3 style={{ margin: 0 }}>Recent Investments</h3>
          <Link to="/dashboard/investments" className="btn btn--ghost btn--sm">
            View all →
          </Link>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {[1, 2].map(i => <div key={i} className="skeleton" style={{ height: 60, borderRadius: 'var(--r-md)' }} />)}
          </div>
        )}

        {/* Error State */}
        {isError && (
          <div className="empty-state" style={{ padding: '2rem 1rem' }}>
            <p className="text-muted text-sm text-center">Failed to load recent investments.</p>
          </div>
        )}

        {/* List State */}
        {!isLoading && !isError && investments.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div 
                  key={inv._id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '1rem',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--r-md)',
                    transition: 'border-color 0.2s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--color-primary-muted)'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--color-border)'}
                >
                  <div style={{ flex: 1 }}>
                    <Link 
                      to={`/campaigns/${inv.campaignId?._id}`}
                      style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-text)', textDecoration: 'none', display: 'block', marginBottom: '4px' }}
                    >
                      {inv.campaignId?.title || 'Unknown Campaign'}
                    </Link>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem' }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>
                        {new Date(inv.createdAt).toLocaleDateString()}
                      </span>
                      <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--color-border)' }} />
                      
                      {inv.status === 'confirmed' ? (
                        <span style={{ color: 'var(--color-emerald-400)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-emerald-400)', boxShadow: '0 0 6px var(--color-emerald-400)' }} />
                          Synced
                        </span>
                      ) : (
                        <span style={{ color: 'var(--color-amber-400)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-amber-400)', animate: 'pulse 2s infinite' }} />
                          Pending Sync
                        </span>
                      )}

                      {inv.txHash && (
                        <>
                          <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--color-border)' }} />
                          <a 
                            href={`${POLYGONSCAN_URL}/${inv.txHash}`} 
                            target="_blank" 
                            rel="noreferrer"
                            style={{ color: 'var(--color-accent)', textDecoration: 'none', fontWeight: 500 }}
                          >
                            View Proof ↗
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--color-primary)' }}>
                      {inv.amount} {inv.currency}
                    </div>
                  </div>
                </div>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !isError && investments.length === 0 && (
          <div className="empty-state" style={{ padding: '2.5rem 1rem' }}>
            <span className="empty-state__emoji">📭</span>
            <p className="empty-state__title">No investments yet.</p>
            <p className="text-muted text-sm" style={{ marginBottom: '1.25rem' }}>
              Browse active campaigns and make your first investment.
            </p>
            <Link to="/discover" className="btn btn--primary btn--sm">
              🔍 Discover Campaigns
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
