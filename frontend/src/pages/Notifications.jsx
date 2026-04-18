/**
 * src/pages/Notifications.jsx
 *
 * Full notification centre page — /notifications
 * Displays paginated list, unread filter toggle, and mark-all-read action.
 */

import { useState }                           from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getNotifications, markAsRead, markAllAsRead } from '../api/notifications.api';

// ─── Type → icon + label ──────────────────────────────────────────────────────
const TYPE_META = {
  investment_received:  { icon: '💰', label: 'Investment Received' },
  investment_confirmed: { icon: '✅', label: 'Investment Confirmed' },
  milestone_updated:    { icon: '📍', label: 'Milestone Updated' },
  milestone_approved:   { icon: '🎉', label: 'Milestone Approved' },
  milestone_rejected:   { icon: '❌', label: 'Milestone Rejected' },
  milestone_disbursed:  { icon: '💸', label: 'Funds Disbursed' },
  campaign_funded:      { icon: '🚀', label: 'Campaign Funded' },
  system:               { icon: 'ℹ️', label: 'System' },
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function Notifications() {
  const qc = useQueryClient();
  const [page, setPage]           = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);

  // ── Fetch ───────────────────────────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ['notifications', page, unreadOnly],
    queryFn:  () => getNotifications({ page, limit: 20, unreadOnly }),
    keepPreviousData: true,
    staleTime: 30_000,
  });

  const notifications = data?.notifications ?? [];
  const pagination    = data?.pagination    ?? { page: 1, totalPages: 1, total: 0 };
  const unreadCount   = data?.unreadCount   ?? 0;

  // ── Mutations ───────────────────────────────────────────────────────────────
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['notifications'] });
    qc.invalidateQueries({ queryKey: ['notifications-unread'] });
    qc.invalidateQueries({ queryKey: ['notifications-preview'] });
  };

  const { mutate: readOne }  = useMutation({ mutationFn: markAsRead,    onSuccess: invalidate });
  const { mutate: readAll }  = useMutation({ mutationFn: markAllAsRead, onSuccess: invalidate });

  return (
    <div className="container" style={{ paddingTop: '2.5rem', paddingBottom: '4rem', maxWidth: 720 }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: 0 }}>🔔 Notifications</h1>
          <p className="text-muted text-sm" style={{ marginTop: 4 }}>
            {unreadCount > 0 ? `${unreadCount} unread` : 'You\'re all caught up'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {/* Unread filter toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(e) => { setUnreadOnly(e.target.checked); setPage(1); }}
              style={{ accentColor: 'var(--color-primary)' }}
            />
            Unread only
          </label>
          {unreadCount > 0 && (
            <button
              id="mark-all-read-btn"
              className="btn btn--ghost btn--sm"
              onClick={() => readAll()}
            >
              Mark all read
            </button>
          )}
        </div>
      </div>

      {/* ── List ───────────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="card" style={{ height: 72, background: 'var(--color-border)', borderRadius: 'var(--r-md)' }} />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state__emoji">🔕</span>
          <p className="empty-state__title" style={{ marginTop: '1rem' }}>No notifications</p>
          <p className="text-muted text-sm">{unreadOnly ? 'No unread notifications.' : 'When investments or milestones occur, they\'ll appear here.'}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {notifications.map((n) => {
            const meta = TYPE_META[n.type] ?? { icon: '🔔', label: n.type };
            return (
              <div
                key={n._id}
                onClick={() => { if (!n.isRead) readOne(n._id); }}
                style={{
                  display:      'flex',
                  gap:          '1rem',
                  alignItems:   'flex-start',
                  padding:      '1rem 1.25rem',
                  background:   n.isRead ? 'var(--color-surface)' : 'rgba(139,92,246,0.07)',
                  borderRadius: 'var(--r-md)',
                  border:       `1px solid ${n.isRead ? 'var(--color-border)' : 'var(--color-primary)'}`,
                  cursor:       n.isRead ? 'default' : 'pointer',
                  transition:   'background 0.15s, border-color 0.15s',
                }}
              >
                {/* Icon */}
                <div style={{ fontSize: '1.5rem', flexShrink: 0, lineHeight: 1.3 }}>
                  {meta.icon}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{
                      fontSize: '0.7rem', fontWeight: 600,
                      padding: '2px 8px', borderRadius: 99,
                      background: 'var(--color-border)',
                      color: 'var(--color-text-muted)',
                    }}>
                      {meta.label}
                    </span>
                    {!n.isRead && (
                      <span style={{
                        fontSize: '0.65rem', fontWeight: 700,
                        padding: '2px 6px', borderRadius: 99,
                        background: 'var(--color-primary)',
                        color: '#fff',
                      }}>
                        NEW
                      </span>
                    )}
                  </div>
                  <p style={{ margin: 0, fontSize: '0.875rem', lineHeight: 1.5, color: 'var(--color-text)' }}>
                    {n.message}
                  </p>
                  <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 6, display: 'block' }}>
                    {timeAgo(n.createdAt)}
                  </span>
                </div>

                {/* Unread dot */}
                {!n.isRead && (
                  <div style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: 'var(--color-primary)', flexShrink: 0, marginTop: 4,
                  }} />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Pagination ─────────────────────────────────────────────────────── */}
      {pagination.totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', marginTop: '2rem' }}>
          <button
            className="btn btn--ghost btn--sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ← Prev
          </button>
          <span className="text-muted text-sm" style={{ alignSelf: 'center' }}>
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            className="btn btn--ghost btn--sm"
            disabled={page >= pagination.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
