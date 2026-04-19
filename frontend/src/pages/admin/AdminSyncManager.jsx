/**
 * src/pages/admin/AdminSyncManager.jsx
 *
 * Administrative interface for monitoring and manually triggering
 * blockchain synchronization events.
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSyncStatus, syncTransaction, syncBlockRange, triggerSyncCycle } from '../../api/admin.api';
import { 
  RefreshCw, 
  Activity, 
  Hash, 
  Layers, 
  AlertCircle, 
  CheckCircle2, 
  ExternalLink,
  Play
} from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

const POLYGONSCAN_URL = import.meta.env.VITE_POLYGONSCAN_URL || 'https://amoy.polygonscan.com/tx';

export default function AdminSyncManager() {
  const queryClient = useQueryClient();
  const [txHashInput, setTxHashInput] = useState('');
  const [rangeInput, setRangeInput] = useState({ from: '', to: '' });

  // ─── Data Fetching ──────────────────────────────────────────────────────────
  const { data: syncData, isLoading, isError, refetch } = useQuery({
    queryKey: ['adminSyncStatus'],
    queryFn: getSyncStatus,
    refetchInterval: 10000, // Poll every 10s for live drift monitoring
  });

  const status = syncData?.data || {};
  const drift = status.drift || 0;
  const isHealthy = drift < 10 && status.status === 'active';

  // ─── Mutations ──────────────────────────────────────────────────────────────
  const txSyncMutation = useMutation({
    mutationFn: (hash) => syncTransaction(hash),
    onSuccess: (res) => {
      toast.success(res.message);
      setTxHashInput('');
      queryClient.invalidateQueries(['adminSyncStatus']);
    },
    onError: (err) => toast.error(err?.response?.data?.message || 'Transaction sync failed'),
  });

  const rangeSyncMutation = useMutation({
    mutationFn: ({ from, to }) => syncBlockRange(from, to),
    onSuccess: (res) => {
      toast.success(res.message);
      setRangeInput({ from: '', to: '' });
      queryClient.invalidateQueries(['adminSyncStatus']);
    },
    onError: (err) => toast.error(err?.response?.data?.message || 'Block range sync failed'),
  });

  const triggerMutation = useMutation({
    mutationFn: triggerSyncCycle,
    onSuccess: (res) => {
      toast.success(res.message);
      queryClient.invalidateQueries(['adminSyncStatus']);
    },
    onError: (err) => toast.error('Failed to trigger sync cycle'),
  });

  // ─── Handlers ───────────────────────────────────────────────────────────────
  const handleTxSync = (e) => {
    e.preventDefault();
    if (!txHashInput) return;
    txSyncMutation.mutate(txHashInput);
  };

  const handleRangeSync = (e) => {
    e.preventDefault();
    if (!rangeInput.from || !rangeInput.to) return;
    rangeSyncMutation.mutate(rangeInput);
  };

  if (isLoading) return <div className="text-gray-400 p-8">Loading sync status...</div>;

  return (
    <div className="max-w-6xl mx-auto">
      <header style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#fff', marginBottom: '0.5rem' }}>
            Blockchain Sync Ledger
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.5)', maxWidth: '600px' }}>
            Monitor and manually reconcile discrepancies between MongoDB and Polygon Amoy. 
            Ensure critical events Like CampaignCreated and InvestmentReceived are processed.
          </p>
        </div>
        <button 
          onClick={() => refetch()}
          style={{ 
            display: 'flex', gap: '8px', alignItems: 'center', 
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            padding: '8px 16px', borderRadius: '8px', color: '#fff', fontSize: '0.9rem', cursor: 'pointer'
          }}
        >
          <RefreshCw size={16} /> Refresh Status
        </button>
      </header>

      {/* ─── Healthy Row ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div style={{ 
          background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', 
          padding: '1.5rem', borderRadius: '16px' 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem', color: isHealthy ? '#10b981' : '#f59e0b' }}>
            <Activity size={24} />
            <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>Service Health</span>
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 600, color: '#fff' }}>
            {status.status?.toUpperCase() || 'UNKNOWN'}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
            Last heartbeat: {new Date(status.lastUpdated).toLocaleTimeString()}
          </div>
        </div>

        <div style={{ 
          background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', 
          padding: '1.5rem', borderRadius: '16px' 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem', color: '#6366f1' }}>
            <Layers size={24} />
            <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>Sync State</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 600, color: '#fff' }}>{status.lastSyncedBlock}</span>
            <span style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.3)' }}>/ {status.currentChainBlock}</span>
          </div>
          <div style={{ fontSize: '0.85rem', color: drift > 100 ? '#ef4444' : 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
            Drift: {drift} blocks {drift > 50 && '⚠️ Lagging'}
          </div>
        </div>

        <div style={{ 
          background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', 
          padding: '1.5rem', borderRadius: '16px', position: 'relative'
        }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem', color: '#ef4444' }}>
            <AlertCircle size={24} />
            <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>Failed Events</span>
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 600, color: '#fff' }}>
            {status.failureCount || 0}
          </div>
          <button 
            disabled={triggerMutation.isPending}
            onClick={() => triggerMutation.mutate()}
            style={{ 
              position: 'absolute', top: '1.5rem', right: '1.5rem',
              background: '#ef4444', color: '#fff', border: 'none',
              padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
            }}
          >
            <Play size={12} fill="currentColor" /> Trigger Fix
          </button>
        </div>
      </div>

      {/* ─── Controls ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.2fr)', gap: '1.5rem', marginBottom: '2.5rem' }}>
        {/* Single TX Sync */}
        <div style={{ 
          background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)', 
          padding: '2rem', borderRadius: '20px' 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
            <Hash size={20} color="#6366f1" />
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#fff' }}>Force TX Sync</h3>
          </div>
          <form onSubmit={handleTxSync}>
            <input 
              type="text" 
              placeholder="Enter Transaction Hash (0x...)"
              value={txHashInput}
              onChange={(e) => setTxHashInput(e.target.value)}
              style={{
                width: '100%', background: '#0a0d14', border: '1px solid rgba(255,255,255,0.1)',
                padding: '12px 16px', borderRadius: '10px', color: '#fff', marginBottom: '1rem',
                fontSize: '0.9rem'
              }}
            />
            <button 
              type="submit"
              disabled={txSyncMutation.isPending || !txHashInput}
              style={{ 
                width: '100%', background: 'linear-gradient(135deg, #6366f1, #a855f7)', 
                color: '#fff', border: 'none', padding: '12px', borderRadius: '10px', 
                fontWeight: 600, cursor: 'pointer', transition: 'opacity 0.2s'
              }}
            >
              {txSyncMutation.isPending ? 'Syncing...' : 'Re-process Transaction'}
            </button>
          </form>
        </div>

        {/* Range Sync */}
        <div style={{ 
          background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)', 
          padding: '2rem', borderRadius: '20px' 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
            <Layers size={20} color="#10b981" />
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#fff' }}>Backfill Block Range</h3>
          </div>
          <form onSubmit={handleRangeSync} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div style={{ gridColumn: 'span 1' }}>
              <input 
                type="number" 
                placeholder="From Block"
                value={rangeInput.from}
                onChange={(e) => setRangeInput({ ...rangeInput, from: e.target.value })}
                style={{
                  width: '100%', background: '#0a0d14', border: '1px solid rgba(255,255,255,0.1)',
                  padding: '12px 16px', borderRadius: '10px', color: '#fff',
                  fontSize: '0.9rem'
                }}
              />
            </div>
            <div style={{ gridColumn: 'span 1' }}>
              <input 
                type="number" 
                placeholder="To Block"
                value={rangeInput.to}
                onChange={(e) => setRangeInput({ ...rangeInput, to: e.target.value })}
                style={{
                  width: '100%', background: '#0a0d14', border: '1px solid rgba(255,255,255,0.1)',
                  padding: '12px 16px', borderRadius: '10px', color: '#fff',
                  fontSize: '0.9rem'
                }}
              />
            </div>
            <button 
              type="submit"
              disabled={rangeSyncMutation.isPending || !rangeInput.from || !rangeInput.to}
              style={{ 
                gridColumn: 'span 2', background: 'linear-gradient(135deg, #10b981, #06b6d4)', 
                color: '#fff', border: 'none', padding: '12px', borderRadius: '10px', 
                fontWeight: 600, cursor: 'pointer', transition: 'opacity 0.2s'
              }}
            >
              {rangeSyncMutation.isPending ? 'Backfilling...' : 'Scan & Sync Range'}
            </button>
          </form>
        </div>
      </div>

      {/* ─── Ledger ─── */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: 0, color: '#fff', fontSize: '1.25rem' }}>Recent Ledger Activity</h3>
        </div>

        <div style={{ 
          background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)', 
          borderRadius: '20px', overflow: 'hidden'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)', textAlign: 'left' }}>
                <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>Event</th>
                <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>Block</th>
                <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>Transaction</th>
                <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>Status</th>
                <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>Processed At</th>
              </tr>
            </thead>
            <tbody>
              {status.recentEvents?.map((ev, i) => (
                <tr key={ev._id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ fontWeight: 700, color: '#fff' }}>{ev.eventName}</div>
                    <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>
                      {ev.keyIdentifier}
                    </div>
                  </td>
                  <td style={{ padding: '1rem', color: 'rgba(255,255,255,0.7)' }}>{ev.blockNumber}</td>
                  <td style={{ padding: '1rem' }}>
                    <a 
                      href={`${POLYGONSCAN_URL}/${ev.transactionHash}`} 
                      target="_blank" 
                      rel="noreferrer"
                      style={{ color: '#6366f1', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      {ev.transactionHash.slice(0, 10)}... <ExternalLink size={12} />
                    </a>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <span style={{ 
                      padding: '4px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 800,
                      background: ev.status === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                      color: ev.status === 'success' ? '#10b981' : '#ef4444',
                      textTransform: 'uppercase'
                    }}>
                      {ev.status}
                    </span>
                    {ev.errorDetails && (
                      <div style={{ fontSize: '0.7rem', color: '#ef4444', marginTop: '4px', maxWidth: '150px' }}>
                        {ev.errorDetails.slice(0, 50)}...
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '1rem', color: 'rgba(255,255,255,0.4)' }}>
                    {new Date(ev.processedAt).toLocaleString()}
                  </td>
                </tr>
              ))}
              {(!status.recentEvents || status.recentEvents.length === 0) && (
                <tr>
                  <td colSpan="5" style={{ padding: '3rem', textAlign: 'center', color: 'rgba(255,255,255,0.2)' }}>
                    No recent events identified.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
