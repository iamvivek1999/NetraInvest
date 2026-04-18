/**
 * src/components/InvestModal.jsx
 *
 * Full invest flow modal for Enigma Invest.
 *
 * ─── Flow ────────────────────────────────────────────────────────────────────
 *
 *  idle
 *   ↓  user enters amount + clicks Invest
 *  connecting      — wallet.connect() if not yet connected
 *   ↓
 *  switching       — wallet.ensureNetwork() for Polygon Amoy
 *   ↓
 *  signing         — contract.invest(campaignKey, { value: wei }) submitted
 *   ↓
 *  confirming      — tx.wait() — waiting for 1 confirmation
 *   ↓
 *  recording       — POST /api/v1/investments (backend DB record)
 *   ↓
 *  success         — shows txHash + PolygonScan link
 *
 *  error           — any step that throws shows a clear error message
 *
 * ─── Stub mode (VITE_STUB_MODE=true) ────────────────────────────────────────
 *  Skips wallet.connect(), ensureNetwork(), and the on-chain call.
 *  Posts directly to backend with txHash=null and amount from form.
 *  Useful for demos and testing before contract is deployed.
 *
 * ─── Props ───────────────────────────────────────────────────────────────────
 *  isOpen       {bool}    — controls visibility
 *  onClose      {fn}      — called when modal should close
 *  campaign     {object}  — full campaign object from getCampaign()
 *  onSuccess    {fn}      — called with { investment, verification } after success
 *
 * ─── Required env vars ───────────────────────────────────────────────────────
 *  VITE_CONTRACT_ADDRESS  — deployed InvestmentPlatform contract address
 *  VITE_CHAIN_ID          — 80002 for Polygon Amoy
 *  VITE_POLYGONSCAN_URL   — https://amoy.polygonscan.com/tx
 *  VITE_STUB_MODE         — "true" to skip blockchain (demo / no contract)
 */

import { useState, useEffect, useCallback } from 'react';
import toast                                  from 'react-hot-toast';
// UPDATED FOR NON-BLOCKCHAIN PAYMENT FLOW
// import useWallet                              from '../hooks/useWallet';
// import { getWriteContract, inrToWei }      from '../utils/contract';
import { recordInvestment }                  from '../api/investments.api';
import { createRazorpayOrder, verifyRazorpayPayment } from '../api/payment.api';
import useAuthStore                           from '../store/authStore';
import {
  CONTRACT_ADDRESS,
  POLYGONSCAN_URL,
  STUB_MODE,
}                                             from '../utils/constants';

// ─── Step labels ──────────────────────────────────────────────────────────────
const STEPS = {
  idle:        'idle',
  // UPDATED FOR NON-BLOCKCHAIN PAYMENT FLOW
  processing:  'Processing payment...',
  recording:   'Recording investment…',
  success:     'success',
  error:       'error',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function shortTx(hash) {
  if (!hash) return '';
  return `${hash.slice(0, 10)}…${hash.slice(-8)}`;
}

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
  // UPDATED FOR NON-BLOCKCHAIN PAYMENT FLOW
  // const wallet   = useWallet();

  const [amount,   setAmount]   = useState('');
  const [step,     setStep]     = useState(STEPS.idle);
  const [txHash,   setTxHash]   = useState(null);
  const [result,   setResult]   = useState(null); // { investment, verification }
  const [errMsg,   setErrMsg]   = useState(null);

  // Reset when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setAmount('');
        setStep(STEPS.idle);
        setTxHash(null);
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
  const contractAddress = CONTRACT_ADDRESS;
  const campaignKey     = campaign?.campaignKey;   // only visible to owner
  const minInvest       = campaign?.minInvestment ?? 0;
  const maxInvest       = campaign?.maxInvestment ?? Infinity;

  const amountNum = parseFloat(amount) || 0;
  const amountOk  = amountNum > 0
    && (minInvest === 0 || amountNum >= minInvest)
    && (maxInvest === Infinity || amountNum <= maxInvest);

  // ── Invest handler ────────────────────────────────────────────────────────
  // UPDATED FOR RAZORPAY PAYMENT FLOW
  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

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
      setStep(STEPS.processing);
      
      // UPDATED FOR LOCAL QA PREP
      const bypassPayment = import.meta.env.VITE_DEV_BYPASS_PAYMENT === 'true';
      if (bypassPayment) {
        console.warn('[DEV MODE] Bypassing Razorpay UI directly to verify backend.');
        setStep(STEPS.recording);
        const verifyPayload = {
          campaignId: campaign._id,
          amount: amountNum,
          razorpay_order_id: 'mock_order_' + Date.now(),
          razorpay_payment_id: 'mock_payment_' + Date.now(),
          razorpay_signature: 'mock_signature'
        };
        const verifiedRes = await verifyRazorpayPayment(verifyPayload);
        setTxHash(verifyPayload.razorpay_payment_id);
        setResult(verifiedRes);
        setStep(STEPS.success);
        toast.success('🎉 [QA Bypassed] Investment successful!');
        onSuccess?.(verifiedRes);
        return;
      }

      const isLoaded = await loadRazorpayScript();
      if (!isLoaded) {
        throw new Error('Failed to load payment gateway. Are you connected to the internet?');
      }

      // 1. Create order
      const orderRes = await createRazorpayOrder({
        campaignId: campaign._id,
        amount: amountNum,
      });

      if (!orderRes || !orderRes.orderId) {
         throw new Error('Failed to generate secure order identifier.');
      }

      // 2. Open Razorpay Checkout Modal
      const options = {
        key: orderRes.key, // Native API key from backend config
        amount: orderRes.amount, 
        currency: orderRes.currency,
        name: 'Enigma Invest',
        description: `Investment in ${campaign.title}`,
        order_id: orderRes.orderId,
        handler: async function (response) {
          try {
            setStep(STEPS.recording);
            // 3. Verify Payment Signature
            const verifyPayload = {
               campaignId: campaign._id,
               amount: amountNum,
               razorpay_order_id: response.razorpay_order_id,
               razorpay_payment_id: response.razorpay_payment_id,
               razorpay_signature: response.razorpay_signature,
            };

            const verifiedRes = await verifyRazorpayPayment(verifyPayload);

            setTxHash(response.razorpay_payment_id);
            setResult(verifiedRes);
            setStep(STEPS.success);
            toast.success('🎉 Investment successful!');
            onSuccess?.(verifiedRes);

          } catch (verifyErr) {
            console.error('[InvestModal] verification error:', verifyErr);
            let errorMessage = verifyErr.message || 'Signature verification failed.';
            if (verifyErr.response?.data?.message) {
              errorMessage = verifyErr.response.data.message;
            }
            setErrMsg(errorMessage);
            setStep(STEPS.error);
          }
        },
        prefill: {
          name: user?.fullName || 'Investor',
          email: user?.email || '',
        },
        theme: {
          color: '#1E3A8A' // Brand matched optionally
        }
      };

      const razorpayInstance = new window.Razorpay(options);
      
      razorpayInstance.on('payment.failed', function (response) {
        setErrMsg(`Payment Failed: ${response.error.description}`);
        setStep(STEPS.error);
      });

      razorpayInstance.open();

    } catch (err) {
      console.error('[InvestModal] investment error:', err);
      let errorMessage = err.message || 'An unexpected error occurred.';
      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      }
      setErrMsg(errorMessage);
      setStep(STEPS.error);
    }
  }, [
    amountOk, amountNum, campaign, user, onSuccess, minInvest, maxInvest,
  ]);

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
          position:   'fixed',
          inset:      0,
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(6px)',
          zIndex:     1000,
          display:    'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding:    '1rem',
        }}
      >
        {/* Modal panel */}
        <div
          id="invest-modal-panel"
          onClick={(e) => e.stopPropagation()}
          style={{
            width:           '100%',
            maxWidth:        480,
            background:      'var(--color-surface)',
            border:          '1px solid var(--color-border)',
            borderRadius:    'var(--r-xl)',
            padding:         '2rem',
            boxShadow:       '0 24px 80px rgba(0,0,0,0.55)',
            display:         'flex',
            flexDirection:   'column',
            gap:             '1.25rem',
            maxHeight:       '90vh',
            overflowY:       'auto',
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

          {/* Stub mode badge */}
          {STUB_MODE && (
            <div style={{
              padding:      '0.5rem 0.875rem',
              borderRadius: 'var(--r-md)',
              background:   'rgba(245,158,11,0.1)',
              border:       '1px solid rgba(245,158,11,0.3)',
              fontSize:     '0.78rem',
              color:        'var(--color-warning)',
            }}>
              🧪 <strong>Stub Mode</strong> — No MetaMask required. Investment will be recorded without a real transaction.
            </div>
          )}

          {/* ── Success state ──────────────────────────────────────────── */}
          {step === STEPS.success && result && (
            <SuccessPanel
              txHash={txHash}
              amount={amountNum}
              campaign={campaign}
              blockchain={result.blockchain}
              onClose={onClose}
            />
          )}

          {/* ── Error state ────────────────────────────────────────────── */}
          {step === STEPS.error && (
            <>
              <div style={{
                padding:      '0.875rem 1rem',
                borderRadius: 'var(--r-md)',
                background: txHash && !STUB_MODE ? 'rgba(245,158,11,0.08)' : 'rgba(239,68,68,0.08)',
                border: txHash && !STUB_MODE ? '1px solid rgba(245,158,11,0.3)' : '1px solid rgba(239,68,68,0.25)',
                fontSize:     '0.82rem',
                color: txHash && !STUB_MODE ? 'var(--color-warning)' : 'var(--color-error)',
                whiteSpace: 'pre-wrap',
              }}>
                <strong>{txHash && !STUB_MODE ? '⚠️ Chain Success / Backend Failure' : 'Investment failed'}</strong>
                <p style={{ margin: '0.4rem 0 0', opacity: 0.85 }}>{errMsg}</p>
                {txHash && !STUB_MODE && (
                  <p style={{ margin: '0.6rem 0 0', fontSize: '0.75rem', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                    TxHash: {txHash}
                  </p>
                )}
              </div>
              <button
                id="invest-modal-retry"
                className="btn btn--ghost"
                onClick={() => { setStep(STEPS.idle); setErrMsg(null); }}
              >
                ← {txHash && !STUB_MODE ? 'Acknowledge' : 'Try Again'}
              </button>
            </>
          )}

          {/* ── Busy state (steps in progress) ────────────────────────── */}
          {isBusy && (
            <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
              <div className="spinner" style={{ width: 40, height: 40, borderWidth: 4, margin: '0 auto 1rem' }} />
              <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{step}</p>
              {txHash && (
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>
                  Tx: {shortTx(txHash)}
                </p>
              )}
            </div>
          )}

          {/* ── Idle form ─────────────────────────────────────────────── */}
          {step === STEPS.idle && (
            <>
              {/* Campaign summary */}
              <div style={{
                background:   'var(--color-bg)',
                borderRadius: 'var(--r-md)',
                padding:      '0.875rem 1rem',
                display:      'flex',
                flexDirection:'column',
                gap:          '0.2rem',
              }}>
                <Row label="Funding Goal"   value={`${campaign?.fundingGoal?.toLocaleString()} INR`} />
                <Row label="Already Raised" value={`${(campaign?.currentRaised ?? 0).toLocaleString()} INR`} />
                {campaign?.minInvestment > 0 && (
                  <Row label="Min Investment" value={`${campaign.minInvestment} INR`} />
                )}
                {campaign?.maxInvestment && (
                  <Row label="Max Investment" value={`${campaign.maxInvestment} INR`} />
                )}
              </div>

              {/* UPDATED FOR NON-BLOCKCHAIN PAYMENT FLOW */}
              {/* <WalletStatusRow wallet={wallet} /> */}

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
              {/* UPDATED FOR NON-BLOCKCHAIN PAYMENT FLOW */}
              <button
                id="invest-submit-btn"
                className="btn btn--primary"
                onClick={handlePayment}
                disabled={!amountOk}
                style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: '1rem' }}
              >
                💳 Proceed to Payment
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Wallet status row shown in idle form ─────────────────────────────────────
function WalletStatusRow({ wallet }) {
  if (!wallet.isInstalled) {
    return (
      <div style={statusBox('rgba(239,68,68,0.07)', 'rgba(239,68,68,0.2)', 'var(--color-error)')}>
        🦊 MetaMask not installed.{' '}
        <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer"
           style={{ color: 'var(--color-error)', textDecoration: 'underline' }}>
          Install MetaMask ↗
        </a>
      </div>
    );
  }
  if (!wallet.isConnected) {
    return (
      <div style={statusBox('rgba(139,92,246,0.07)', 'rgba(139,92,246,0.2)', 'var(--color-primary)')}>
        <span>🦊 Wallet not connected.</span>
        <button
          id="invest-modal-connect-wallet"
          className="btn btn--sm"
          onClick={wallet.connect}
          style={{ marginLeft: 'auto', padding: '4px 12px', fontSize: '0.75rem' }}
        >
          Connect
        </button>
      </div>
    );
  }
  if (!wallet.isCorrectChain) {
    return (
      <div style={statusBox('rgba(245,158,11,0.07)', 'rgba(245,158,11,0.25)', 'var(--color-warning)')}>
        <span>⚠️ Wrong network. Connect to Polygon Amoy.</span>
        <button
          id="invest-modal-switch-network"
          className="btn btn--sm"
          onClick={wallet.ensureNetwork}
          style={{ marginLeft: 'auto', padding: '4px 12px', fontSize: '0.75rem', border: '1px solid rgba(245,158,11,0.4)', color: 'var(--color-warning)', background: 'transparent' }}
        >
          Switch
        </button>
      </div>
    );
  }
  return (
    <div style={statusBox('rgba(16,185,129,0.07)', 'rgba(16,185,129,0.25)', 'var(--color-success)')}>
      ✅ <code style={{ fontSize: '0.78rem' }}>{wallet.account}</code>
      <span style={{ marginLeft: 'auto', fontSize: '0.7rem', opacity: 0.7 }}>Amoy ✓</span>
    </div>
  );
}

function statusBox(bg, border, color) {
  return {
    display:      'flex',
    alignItems:   'center',
    gap:          '0.5rem',
    padding:      '0.6rem 0.875rem',
    borderRadius: 'var(--r-md)',
    background:   bg,
    border:       `1px solid ${border}`,
    fontSize:     '0.81rem',
    color,
  };
}

// ─── Success panel ────────────────────────────────────────────────────────────
function SuccessPanel({ txHash, amount, campaign, onClose, blockchain }) {
  // Use the global STUB_MODE constant so we don't rely on missing backend fields
  const isStub = !!STUB_MODE;
  
  // UPDATED FOR BLOCKCHAIN TRANSPARENCY LAYER
  const txUrl = blockchain?.txHash ? `https://amoy.polygonscan.com/tx/${blockchain.txHash}` : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>{isStub ? '🧪' : '🎉'}</div>
        <h4 style={{ margin: 0, color: isStub ? 'var(--color-warning)' : 'var(--color-success)' }}>
          {isStub ? 'Simulated Investment Successful' : 'Investment Confirmed!'}
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
        {!isStub && txHash && <Row label="Payment ID" value={shortTx(txHash)} mono />}
        <Row label="Amount"     value={`${amount} INR`} />
        {isStub && (
          <Row label="Notice" value="Dev/Simulation Only (No Chain Tx)" />
        )}
        
        {/* Transparency layer display */}
        {blockchain && !isStub && (
           <>
             <div style={{ margin: '0.5rem 0', borderBottom: '1px solid var(--color-border)' }} />
             <Row 
               label="Transparency Layer" 
               value={
                 blockchain.status === 'logged' ? '✅ Logged' : 
                 blockchain.status === 'failed' ? '❌ Failed' : '⏳ Pending'
               } 
             />
             {blockchain.txHash && <Row label="Audit Hash" value={shortTx(blockchain.txHash)} mono />}
           </>
        )}
      </div>

      {txUrl && (
        <a
          href={txUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn--ghost"
          style={{ textAlign: 'center', justifyContent: 'center' }}
          id="invest-polygonscan-link"
        >
          View Audit Log on PolygonScan ↗
        </a>
      )}

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

