/**
 * src/components/NotificationBell.jsx
 *
 * Notification bell icon shown in the navbar.
 * Polls unread count every 60 seconds.
 * Opens a dropdown with the 5 most recent notifications.
 * "View all" navigates to /notifications page.
 */

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from '../api/notifications.api';
import useAuthStore from '../store/authStore';

// ─── Type → icon map ──────────────────────────────────────────────────────────
const TYPE_ICON = {
  investment_received:  '💰',
  investment_confirmed: '✅',
  milestone_updated:    '📍',
  milestone_approved:   '🎉',
  milestone_rejected:   '❌',
  milestone_disbursed:  '💸',
  campaign_funded:      '🚀',
  system:               'ℹ️',
};

// ─── Relative time helper ─────────────────────────────────────────────────────
function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function NotificationBell() {
  const { isLoggedIn } = useAuthStore();
  const navigate       = useNavigate();
  const qc             = useQueryClient();
  const [open, setOpen]  = useState(false);
  const dropRef          = useRef(null);

  // ── Click outside to close ───────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Unread count (poll every 60s) ────────────────────────────────────────
  const { data: unread = 0 } = useQuery({
    queryKey: ['notifications-unread'],
    queryFn:  getUnreadCount,
    enabled:  isLoggedIn,
    refetchInterval: 60_000,
    staleTime:       30_000,
  });

  // ── Recent preview (fetched when dropdown opens) ──────────────────────────
  const { data: preview } = useQuery({
    queryKey: ['notifications-preview'],
    queryFn:  () => getNotifications({ page: 1, limit: 5 }),
    enabled:  isLoggedIn && open,
    staleTime: 30_000,
  });
  const recent = preview?.notifications ?? [];

  // ── Mark single read ──────────────────────────────────────────────────────
  const { mutate: readOne } = useMutation({
    mutationFn: markAsRead,
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['notifications-unread'] });
      qc.invalidateQueries({ queryKey: ['notifications-preview'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // ── Mark all read ─────────────────────────────────────────────────────────
  const { mutate: readAll } = useMutation({
    mutationFn: markAllAsRead,
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['notifications-unread'] });
      qc.invalidateQueries({ queryKey: ['notifications-preview'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  if (!isLoggedIn) return null;

  return (
    <div ref={dropRef} style={{ position: 'relative' }}>
      {/* ── Bell button ────────────────────────────────────────────────── */}
      <button
        id="notification-bell-btn"
        onClick={() => setOpen((v) => !v)}
        style={{
          position:   'relative',
          background: 'none',
          border:     'none',
          cursor:     'pointer',
          padding:    '6px 8px',
          borderRadius: 'var(--r-md)',
          color:      'var(--color-text)',
          fontSize:   '1.25rem',
          lineHeight: 1,
          transition: 'background 0.15s',
        }}
        aria-label="Notifications"
      >
        🔔
        {unread > 0 && (
          <span style={{
            position:   'absolute',
            top:        2,
            right:      2,
            minWidth:   18,
            height:     18,
            padding:    '0 4px',
            background: 'var(--color-danger, #ef4444)',
            color:      '#fff',
            borderRadius: 9,
            fontSize:   '0.65rem',
            fontWeight: 700,
            display:    'flex',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 1,
          }}>
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {/* ── Dropdown panel ───────────────────────────────────────────────── */}
      {open && (
        <div style={{
          position:   'absolute',
          top:        'calc(100% + 8px)',
          right:      0,
          width:      340,
          maxHeight:  480,
          overflowY:  'auto',
          background: 'var(--color-surface)',
          border:     '1px solid var(--color-border)',
          borderRadius: 'var(--r-lg)',
          boxShadow:  '0 8px 32px rgba(0,0,0,.35)',
          zIndex:     9999,
        }}>
          {/* Header */}
          <div style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            padding:        '12px 16px',
            borderBottom:   '1px solid var(--color-border)',
          }}>
            <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>
              Notifications {unread > 0 && <span style={{ color: 'var(--color-primary)' }}>({unread})</span>}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              {unread > 0 && (
                <button
                  onClick={() => readAll()}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: '0.75rem', color: 'var(--color-primary)', padding: '2px 6px',
                  }}
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={() => { setOpen(false); navigate('/notifications'); }}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: '0.75rem', color: 'var(--color-text-muted)', padding: '2px 6px',
                }}
              >
                View all →
              </button>
            </div>
          </div>

          {/* Notification items */}
          {recent.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
              No notifications yet
            </div>
          ) : (
            recent.map((n) => (
              <div
                key={n._id}
                onClick={() => { if (!n.isRead) readOne(n._id); }}
                style={{
                  display:    'flex',
                  gap:        12,
                  padding:    '12px 16px',
                  cursor:     n.isRead ? 'default' : 'pointer',
                  background: n.isRead ? 'transparent' : 'rgba(139,92,246,0.06)',
                  borderBottom: '1px solid var(--color-border)',
                  transition: 'background 0.15s',
                }}
              >
                <div style={{ fontSize: '1.25rem', flexShrink: 0, lineHeight: 1.4 }}>
                  {TYPE_ICON[n.type] ?? '🔔'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: '0.8rem', lineHeight: 1.5, color: 'var(--color-text)' }}>
                    {n.message}
                  </p>
                  <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: 4, display: 'block' }}>
                    {timeAgo(n.createdAt)}
                  </span>
                </div>
                {!n.isRead && (
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: 'var(--color-primary)', flexShrink: 0, marginTop: 6,
                  }} />
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
