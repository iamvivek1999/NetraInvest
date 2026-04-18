/**
 * src/components/InvestModal.jsx
 *
 * Simulated investment flow modal for Enigma Invest.
 * Bypasses Razorpay and blockchain by sending `paymentProvider: 'stub'`
 * directly to the backend.
 */

import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { recordInvestment } from '../api/investments.api';
import useAuthStore from '../store/authStore';

// ─── Step labels ──────────────────────────────────────────────────────────────
const STEPS = {
  idle: 'idle',
  recording: 'Recording investment…',
  success: 'success',
  error: 'error',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function Row({ label, value, mono = false }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', padding: '0.3rem 0' }}>
      <span style={{ color: 'var(--color-text-muted)' }}>{label}</span>
      <span style={{ fontFamily: mono ? 'monospace' : undefined, fontWeight: 600, wordBreak: 'break-all', textAlign: 'right', maxWidth: '60%' }}>
        {value}
      </span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function InvestModal({ isOpen, onClose, campaign, onSuccess }) {
  const { user } = useAuthStore();

  const [amount, setAmount] = useState('');
  const [step, setStep] = useState(STEPS.idle);
  const [result, setResult] = useState(null); // { investment, verification }
  const [errMsg, setErrMsg] = useState(null);

  // Reset when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setAmount('');
        setStep(STEPS.idle);
        setResult(null);
        setErrMsg(null);
      }, 300); // slight delay so transition looks clean
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // ── Pre-flight validations rendered as inline guards ─────────────────────
  const minInvest = campaign?.minInvestment ?? 0;
  const maxInvest = campaign?.maxInvestment ?? Infinity;

  const amountNum = parseFloat(amount) || 0;
  const amountOk = amountNum > 0
    && (minInvest === 0 || amountNum >= minInvest)
    && (maxInvest === Infinity || amountNum <= maxInvest);

  // ── Invest handler (Simulated) ───────────────────────────────────────────
  const handlePayment = useCallback(async () => {
    setErrMsg(null);

    // ── Validate amount ───────────────────────────────────────────────────
    if (!amountOk) {
      const min = minInvest ? `Min: ${minInvest} INR.` : '';
      const max = maxInvest !== Infinity ? ` Max: ${maxInvest} INR.` : '';
      setErrMsg(`Invalid amount.${min}${max}`);
      return;
    }

    try {
      setStep(STEPS.recording);

      const payload = {
        campaignId: campaign._id,
        amount: amountNum,
        paymentProvider: 'stub',
      };

      const verifiedRes = await recordInvestment(payload);

      setResult(verifiedRes);
      setStep(STEPS.success);
      toast.success('🎉 Investment successful!');
      onSuccess?.(verifiedRes);

    } catch (err) {
      console.error('[InvestModal] investment error:', err);
      let errorMessage = err.message || 'An unexpected error occurred.';
      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      }
      setErrMsg(errorMessage);
      setStep(STEPS.error);
    }
  }, [amountOk, amountNum, campaign, onSuccess, minInvest, maxInvest]);

  // ─── Don't render if closed ───────────────────────────────────────────────
  if (!isOpen) return null;

  const isBusy = ![STEPS.idle, STEPS.success, STEPS.error].includes(step);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      {/* Overlay */}
      <div
        id="invest-modal-overlay"
        onClick={isBusy ? undefined : onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(6px)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
        }}
      >
        {/* Modal panel */}
        <div
          id="invest-modal-panel"
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '100%',
            maxWidth: 480,
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--r-xl)',
            padding: '2rem',
            boxShadow: '0 24px 80px rgba(0,0,0,0.55)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            maxHeight: '90vh',
            overflowY: 'auto',
          }}
        >

          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h3 style={{ marginBottom: '0.2rem' }}>💸 Invest</h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', margin: 0 }}>
                {campaign?.title}
              </p>
            </div>
            {!isBusy && (
              <button
                id="invest-modal-close"
                onClick={onClose}
                style={{
                  background: 'none', border: 'none',
                  fontSize: '1.25rem', cursor: 'pointer',
                  color: 'var(--color-text-muted)', lineHeight: 1,
                }}
              >
                ✕
              </button>
            )}
          </div>

          <div style={{
            padding: '0.5rem 0.875rem',
            borderRadius: 'var(--r-md)',
            background: 'rgba(245,158,11,0.1)',
            border: '1px solid rgba(245,158,11,0.3)',
            fontSize: '0.78rem',
            color: 'var(--color-warning)',
          }}>
            🧪 <strong>Simulated Flow</strong> — No payment required.
          </div>

          {/* ── Success state ──────────────────────────────────────────── */}
          {step === STEPS.success && result && (
            <SuccessPanel
              amount={amountNum}
              campaign={campaign}
              onClose={onClose}
            />
          )}

          {/* ── Error state ────────────────────────────────────────────── */}
          {step === STEPS.error && (
            <>
              <div style={{
                padding: '0.875rem 1rem',
                borderRadius: 'var(--r-md)',
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.25)',
                fontSize: '0.82rem',
                color: 'var(--color-error)',
                whiteSpace: 'pre-wrap',
              }}>
                <strong>Investment failed</strong>
                <p style={{ margin: '0.4rem 0 0', opacity: 0.85 }}>{errMsg}</p>
              </div>
              <button
                id="invest-modal-retry"
                className="btn btn--ghost"
                onClick={() => { setStep(STEPS.idle); setErrMsg(null); }}
              >
                ← Try Again
              </button>
            </>
          )}

          {/* ── Busy state (steps in progress) ────────────────────────── */}
          {isBusy && (
            <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
              <div className="spinner" style={{ width: 40, height: 40, borderWidth: 4, margin: '0 auto 1rem' }} />
              <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{step}</p>
            </div>
          )}

          {/* ── Idle form ─────────────────────────────────────────────── */}
          {step === STEPS.idle && (
            <>
              {/* Campaign summary */}
              <div style={{
                background: 'var(--color-bg)',
                borderRadius: 'var(--r-md)',
                padding: '0.875rem 1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.2rem',
              }}>
                <Row label="Funding Goal" value={`${campaign?.fundingGoal?.toLocaleString()} INR`} />
                <Row label="Already Raised" value={`${(campaign?.currentRaised ?? 0).toLocaleString()} INR`} />
                {campaign?.minInvestment > 0 && (
                  <Row label="Min Investment" value={`${campaign.minInvestment} INR`} />
                )}
                {campaign?.maxInvestment && (
                  <Row label="Max Investment" value={`${campaign.maxInvestment} INR`} />
                )}
              </div>

              {/* Amount input */}
              <div>
                <label
                  htmlFor="invest-amount-input"
                  style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}
                >
                  Amount (INR)
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="invest-amount-input"
                    type="number"
                    className="input"
                    placeholder={minInvest > 0 ? `Min ${minInvest}` : '0.1'}
                    value={amount}
                    min={minInvest || 0}
                    max={maxInvest !== Infinity ? maxInvest : undefined}
                    step="0.01"
                    onChange={(e) => setAmount(e.target.value)}
                    style={{ width: '100%', paddingRight: '3.5rem' }}
                  />
                  <span style={{
                    position: 'absolute', right: '0.75rem', top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: '0.75rem', color: 'var(--color-text-muted)',
                    pointerEvents: 'none',
                  }}>
                    INR
                  </span>
                </div>
                {amountNum > 0 && !amountOk && (
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-error)', marginTop: '0.3rem' }}>
                    {minInvest > 0 && amountNum < minInvest && `Minimum is ${minInvest} INR.`}
                    {maxInvest !== Infinity && amountNum > maxInvest && `Maximum is ${maxInvest} INR.`}
                  </p>
                )}
              </div>

              {/* CTA */}
              <button
                id="invest-submit-btn"
                className="btn btn--primary"
                onClick={handlePayment}
                disabled={!amountOk}
                style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: '1rem', background: 'var(--color-accent)' }}
              >
                Confirm Investment
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Success panel ────────────────────────────────────────────────────────────
function SuccessPanel({ amount, campaign, onClose }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🧪</div>
        <h4 style={{ margin: 0, color: 'var(--color-warning)' }}>
          Simulated Investment Successful
        </h4>
        <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', marginTop: '0.3rem' }}>
          {amount} INR → {campaign?.title}
        </p>
      </div>

      <div style={{
        background: 'var(--color-bg)',
        borderRadius: 'var(--r-md)',
        padding: '0.875rem 1rem',
        display: 'flex', flexDirection: 'column', gap: '0.2rem',
      }}>
        <Row label="Amount" value={`${amount} INR`} />
        <Row label="Notice" value="Dev/Simulation Only (No Chain Tx)" />
      </div>

      <button
        id="invest-modal-done"
        className="btn btn--primary"
        onClick={onClose}
        style={{ width: '100%', justifyContent: 'center' }}
      >
        Done
      </button>
    </div>
  );
}
