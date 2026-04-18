/**
 * src/components/WalletButton.jsx
 *
 * Reusable compact wallet status indicator / connect button.
 *
 * Props:
 *   wallet   {object}  — the return value of useWallet()
 *   compact  {bool}    — use a small pill format (for navbars)
 *   className {string} — additional CSS class
 *
 * States rendered:
 *   Not installed  → "Install MetaMask" link
 *   Not connected  → "Connect Wallet" button
 *   Connecting     → spinner
 *   Wrong network  → "Switch Network" button (amber)
 *   Connected      → address pill (green)
 */

import useWallet    from '../hooks/useWallet';
import { CHAIN_ID } from '../utils/constants';

// Truncate 0x… address to "0x1234…abcd"
function shortAddr(addr) {
  if (!addr) return '';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function WalletButton({ compact = false, className = '' }) {
  const wallet = useWallet();

  // ── Not installed ─────────────────────────────────────────────────────────
  if (!wallet.isInstalled) {
    return (
      <a
        href="https://metamask.io/download/"
        target="_blank"
        rel="noopener noreferrer"
        className={`btn btn--ghost btn--sm ${className}`}
        style={{ fontSize: compact ? '0.75rem' : undefined }}
        id="wallet-install-link"
      >
        🦊 Install MetaMask
      </a>
    );
  }

  // ── Not connected ─────────────────────────────────────────────────────────
  if (!wallet.isConnected) {
    return (
      <button
        id="wallet-connect-btn"
        className={`btn btn--ghost btn--sm ${className}`}
        onClick={wallet.connect}
        disabled={wallet.isConnecting}
        style={{ fontSize: compact ? '0.75rem' : undefined }}
      >
        {wallet.isConnecting
          ? <><span className="spinner" style={{ width: 12, height: 12, borderWidth: 2, marginRight: 6 }} />Connecting…</>
          : '🦊 Connect Wallet'}
      </button>
    );
  }

  // ── Connected but wrong network ───────────────────────────────────────────
  if (!wallet.isCorrectChain) {
    return (
      <button
        id="wallet-switch-network-btn"
        className={`btn btn--sm ${className}`}
        onClick={wallet.ensureNetwork}
        style={{
          background:    'rgba(245,158,11,0.12)',
          border:        '1px solid rgba(245,158,11,0.35)',
          color:         'var(--color-warning)',
          fontSize:      compact ? '0.75rem' : undefined,
        }}
      >
        ⚠️ Switch to Amoy
      </button>
    );
  }

  // ── Connected + correct network ───────────────────────────────────────────
  return (
    <div
      id="wallet-address-pill"
      className={className}
      style={{
        display:      'flex',
        alignItems:   'center',
        gap:          '0.4rem',
        padding:      compact ? '4px 10px' : '6px 14px',
        background:   'rgba(16,185,129,0.1)',
        border:       '1px solid rgba(16,185,129,0.3)',
        borderRadius: 9999,
        fontSize:     compact ? '0.72rem' : '0.8rem',
        color:        'var(--color-success)',
        fontFamily:   'monospace',
        cursor:       'default',
        userSelect:   'none',
      }}
      title={wallet.account}
    >
      <span style={{
        width: 8, height: 8,
        borderRadius: '50%',
        background: 'var(--color-success)',
        flexShrink: 0,
        boxShadow: '0 0 6px var(--color-success)',
      }} />
      {shortAddr(wallet.account)}
    </div>
  );
}
