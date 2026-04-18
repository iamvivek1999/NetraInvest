/**
 * src/pages/dashboard/InvestorHistory.jsx
 *
 * Dedicated page for an investor to view their full investment history.
 * Fetches from GET /api/v1/investments/my.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getMyInvestments } from '../../api/investments.api';
import { formatINR } from '../../utils/formatters';

const POLYGONSCAN_URL = import.meta.env.VITE_POLYGONSCAN_URL || 'https://amoy.polygonscan.com/tx';
const STUB_MODE       = import.meta.env.VITE_STUB_MODE === 'true';

// Status styling mapping
const STATUS_META = {
  confirmed:  { color: 'var(--color-success)', bg: 'rgba(16,185,129,0.1)',  label: 'Confirmed', icon: '✅' },
  unverified: { color: 'var(--color-warning)', bg: 'rgba(245,158,11,0.1)',  label: 'Stub / Unverified', icon: '⏳' },
  failed:     { color: 'var(--color-error)',   bg: 'rgba(239,68,68,0.1)',   label: 'Failed',    icon: '❌' },
};

export default function InvestorHistory() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['myInvestments', page, statusFilter],
    queryFn: () => getMyInvestments({ page, limit: 10, status: statusFilter || undefined }),
    keepPreviousData: true,
  });

  const investments = data?.investments || [];
  const meta = data?.meta || { total: 0, pages: 1 };

  return (
    <div className="animate-fade-in">
      <div className="dashboard__header" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ margin: 0 }}>💰 Investment History</h2>
          <p className="text-muted text-sm" style={{ marginTop: '0.3rem' }}>
            Track every contribution across all your campaigns.
          </p>
        </div>
        
        {/* Status Filter */}
        <select 
          value={statusFilter} 
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="form-control"
          style={{ width: 'auto', minWidth: '150px' }}
        >
          <option value="">All Statuses</option>
          <option value="confirmed">Confirmed</option>
          <option value="unverified">Stub / Unverified</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      <div className="card" style={{ padding: '0' }}>
        {isLoading ? (
          <div style={{ padding: '2rem' }}>
            {[1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ height: 60, marginBottom: '1rem', borderRadius: 'var(--r-md)' }} />)}
          </div>
        ) : isError ? (
          <div className="empty-state" style={{ padding: '3rem 1rem' }}>
            <span style={{ fontSize: '2rem' }}>⚠️</span>
            <p className="empty-state__title">Failed to load history</p>
            <button className="btn btn--ghost btn--sm" onClick={() => refetch()} style={{ marginTop: '1rem' }}>Retry</button>
          </div>
        ) : investments.length === 0 ? (
          <div className="empty-state" style={{ padding: '4rem 1rem' }}>
            <span className="empty-state__emoji">📭</span>
            <p className="empty-state__title">No investments found</p>
            <p className="text-muted text-sm" style={{ marginBottom: '1.25rem' }}>
              {statusFilter ? `You have no ${statusFilter} investments.` : "You haven't made any investments yet."}
            </p>
            {!statusFilter && (
              <Link to="/discover" className="btn btn--primary btn--sm">
                🔍 Discover Campaigns
              </Link>
            )}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
                  <th style={{ padding: '1rem', fontWeight: 600 }}>Campaign</th>
                  <th style={{ padding: '1rem', fontWeight: 600 }}>Amount</th>
                  <th style={{ padding: '1rem', fontWeight: 600 }}>Campaign Progress</th>
                  <th style={{ padding: '1rem', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '1rem', fontWeight: 600 }}>Date</th>
                  <th style={{ padding: '1rem', fontWeight: 600 }}>Audit Record</th>
                </tr>
              </thead>
              <tbody>
                {investments.map(inv => {
                  const metaStatus = STATUS_META[inv.status] || STATUS_META.failed;
                  const isStub = STUB_MODE || inv.status === 'unverified';
                  const displayHash = inv.blockchainTxHash || inv.txHash;
                  const txUrl = displayHash && !isStub ? `${POLYGONSCAN_URL}/${displayHash}` : null;

                  return (
                    <tr key={inv._id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ fontWeight: 600 }}>
                          {inv.campaignId ? (
                            <Link to={`/campaigns/${inv.campaignId._id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                              {inv.campaignId.title} <span style={{ color: 'var(--color-primary)', fontSize: '0.8em' }}>↗</span>
                            </Link>
                          ) : (
                            'Unknown Campaign'
                          )}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                          {inv.startupProfileId?.startupName || 'Unknown Startup'}
                        </div>
                      </td>
                      <td style={{ padding: '1rem', fontWeight: 600 }}>
                        {formatINR(inv.amount)}
                      </td>
                      <td style={{ padding: '1rem' }}>
                        {inv.campaignId && inv.campaignId.fundingGoal ? (
                          <div style={{ width: '100%', maxWidth: '150px' }}>
                            <div style={{
                              display: 'flex', justifyContent: 'space-between',
                              fontSize: '0.75rem', marginBottom: '0.25rem'
                            }}>
                              <span style={{ color: 'var(--color-primary)' }}>
                                {formatINR(inv.campaignId.currentRaised)}
                              </span>
                              <span className="text-muted">
                                {Math.min(100, Math.round((inv.campaignId.currentRaised / inv.campaignId.fundingGoal) * 100))}%
                              </span>
                            </div>
                            <div style={{
                              width: '100%', height: '6px',
                              background: 'rgba(255,255,255,0.1)', borderRadius: '99px', overflow: 'hidden'
                            }}>
                              <div style={{
                                width: `${Math.min(100, (inv.campaignId.currentRaised / inv.campaignId.fundingGoal) * 100)}%`,
                                height: '100%',
                                background: 'var(--color-primary)',
                                borderRadius: '99px',
                                transition: 'width 0.5s ease-out'
                              }} />
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted text-sm">N/A</span>
                        )}
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                          background: metaStatus.bg, color: metaStatus.color,
                          padding: '0.25rem 0.6rem', borderRadius: 99,
                          fontSize: '0.75rem', fontWeight: 600
                        }}>
                          {metaStatus.icon} {metaStatus.label}
                        </span>
                      </td>
                      <td style={{ padding: '1rem', color: 'var(--color-text-muted)' }}>
                        {new Date(inv.createdAt).toLocaleString()}
                      </td>
                      <td style={{ padding: '1rem' }}>
                        {txUrl ? (
                          <a href={txUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)', textDecoration: 'none', fontFamily: 'monospace' }}>
                            {displayHash.slice(0, 10)}...
                          </a>
                        ) : displayHash ? (
                          <span style={{ color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>
                            {displayHash.slice(0, 10)}...
                          </span>
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                            Simulated
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {meta.pages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1rem', borderTop: '1px solid var(--color-border)' }}>
            <button 
              className="btn btn--outline btn--sm" 
              disabled={page <= 1} 
              onClick={() => setPage(p => p - 1)}
            >
              ← Previous
            </button>
            <span className="text-muted text-sm">
              Page {page} of {meta.pages}
            </span>
            <button 
              className="btn btn--outline btn--sm" 
              disabled={page >= meta.pages} 
              onClick={() => setPage(p => p + 1)}
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
