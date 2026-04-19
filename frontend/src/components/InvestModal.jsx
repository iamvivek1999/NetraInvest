import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { useInvestFlow } from '../hooks/useInvestFlow';
import useWallet from '../hooks/useWallet';
import { fromWei } from '../utils/contract';
import { POLYGONSCAN_URL } from '../utils/constants';

// ─── Sub-components ───────────────────────────────────────────────────────────

const StepIndicator = ({ currentStep, totalSteps }) => {
  return (
    <div className="flex gap-2 mb-6">
      {Array.from({ length: totalSteps }).map((_, i) => (
        <div 
          key={i} 
          className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
            i <= currentStep ? 'bg-indigo-500' : 'bg-slate-700'
          }`}
        />
      ))}
    </div>
  );
};

const Row = ({ label, value, mono = false, color = 'var(--color-text)' }) => (
  <div className="flex justify-between items-center py-2 border-b border-slate-700/50 last:border-0">
    <span className="text-xs text-slate-400 font-medium">{label}</span>
    <span 
      className={`text-sm font-semibold text-right ${mono ? 'font-mono' : ''}`}
      style={{ color }}
    >
      {value}
    </span>
  </div>
);

const Loader = ({ label }) => (
  <div className="flex flex-col items-center justify-center py-10">
    <div className="relative w-16 h-16">
      <div className="absolute inset-0 border-4 border-indigo-500/20 rounded-full" />
      <div className="absolute inset-0 border-4 border-transparent border-t-indigo-500 rounded-full animate-spin" />
    </div>
    <p className="mt-6 text-base font-bold text-white tracking-tight">{label}</p>
    <p className="mt-1 text-xs text-slate-400">Do not close this window</p>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

export default function InvestModal({ isOpen, onClose, campaign, onSuccess }) {
  const [amount, setAmount] = useState('');
  const [step, setStep] = useState(0); // 0: Input, 1: Review, 2: Execute

  const { state, invest, retrySync, reset, estimateGas, STATES, preflightError } = useInvestFlow();
  const { connect, ensureNetwork, account, formattedBalance } = useWallet();

  const isBusy = [STATES.AWAITING_SIGNATURE, STATES.PENDING, STATES.SYNCING].includes(state.phase);

  // Auto-advance to Execute step when invest starts
  useEffect(() => {
    if (isBusy || state.phase === STATES.SUCCESS || state.errorCode) {
      setStep(2);
    }
  }, [state.phase, isBusy]);

  // Reset local state on close
  useEffect(() => {
    if (!isOpen) {
      const timer = setTimeout(() => {
        setAmount('');
        setStep(0);
        reset();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen, reset]);

  // Handle successful investment
  useEffect(() => {
    if (state.phase === STATES.SUCCESS && state.investment) {
      toast.success('Investment confirmed!');
      onSuccess?.(state);
    }
  }, [state.phase, state.investment, onSuccess, STATES.SUCCESS]);

  // ── Logic ──────────────────────────────────────────────────────────────────
  const minInvest = useMemo(() => {
    if (!campaign) return 0;
    return campaign.minInvestmentWei ? parseFloat(fromWei(campaign.minInvestmentWei)) : (campaign.minInvestment || 0);
  }, [campaign]);

  const maxInvest = useMemo(() => {
    if (!campaign) return Infinity;
    return campaign.maxInvestmentWei ? parseFloat(fromWei(campaign.maxInvestmentWei)) : Infinity;
  }, [campaign]);

  const amountNum = parseFloat(amount) || 0;
  const isAmountValid = amountNum >= minInvest && (maxInvest === Infinity || amountNum <= maxInvest);

  const handleNext = async () => {
    if (step === 0 && isAmountValid) {
      // Transition to Review step and fetch gas estimate
      setStep(1);
      estimateGas({ campaignKey: campaign.campaignKey, amount: amountNum });
    } else if (step === 1) {
      // Execute investment
      invest({
        campaignId:  campaign._id,
        campaignKey: campaign.campaignKey,
        amount:      amountNum,
      });
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-hidden">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={isBusy ? undefined : onClose}
          className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
        />

        {/* Modal Panel */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-6 pb-0 flex justify-between items-start">
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Invest in {campaign?.title}</h2>
              <p className="text-sm text-slate-400 mt-1">On-chain investment via Polygon Amoy</p>
            </div>
            {!isBusy && (
              <button 
                onClick={onClose}
                className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          <div className="p-6">
            {state.phase === STATES.IDLE && step < 2 && (
              <StepIndicator currentStep={step} totalSteps={2} />
            )}

            <AnimatePresence mode="wait">
              {/* STEP 0: INPUT */}
              {step === 0 && state.phase === STATES.IDLE && (
                <motion.div
                  key="step0"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  {/* Account Status Card */}
                  <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Wallet Balance</p>
                        <p className="text-sm font-mono font-bold text-white">{formattedBalance} POL</p>
                      </div>
                    </div>
                    {preflightError && (
                      <button 
                        onClick={preflightError.errorCode === 'NOT_CONNECTED' ? connect : ensureNetwork}
                        className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-900 text-xs font-bold rounded-lg transition-colors"
                      >
                        {preflightError.errorCode === 'NOT_CONNECTED' ? 'Connect' : 'Switch Net'}
                      </button>
                    )}
                  </div>

                  {/* Input field */}
                  <div>
                    <label className="block text-sm font-bold text-slate-300 mb-2">Amount to Invest</label>
                    <div className="relative group">
                      <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder={`Min ${minInvest} POL`}
                        className="w-full bg-slate-950/50 border border-slate-800 focus:border-indigo-500 rounded-2xl p-4 text-2xl font-mono font-bold text-white transition-all outline-none"
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">POL</div>
                    </div>
                    <div className="flex justify-between mt-2 px-1">
                      <p className="text-xs text-slate-500 font-medium">
                        Min: {minInvest} POL • Max: {maxInvest === Infinity ? 'Unlimited' : `${maxInvest} POL`}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleNext}
                    disabled={!isAmountValid || !!preflightError}
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-2xl shadow-xl shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 group"
                  >
                    <span>Continue to Review</span>
                    <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </button>
                </motion.div>
              )}

              {/* STEP 1: REVIEW */}
              {step === 1 && state.phase === STATES.IDLE && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="p-6 bg-slate-950/50 rounded-3xl border border-slate-800 space-y-1">
                    <Row label="Investment Amount" value={`${amountNum} POL`} />
                    <Row label="Estimated Network Fee" value={state.estimatedGas ? `~${state.estimatedGas} POL` : 'Estimating...'} mono />
                    <div className="pt-4 mt-2 border-t border-slate-800 flex justify-between items-center">
                      <span className="text-sm font-bold text-white">Total Estimated Cost</span>
                      <span className="text-lg font-mono font-black text-indigo-400">
                        {state.totalCost ? `${state.totalCost} POL` : '...'}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <button
                      onClick={() => setStep(0)}
                      className="flex-[1] py-4 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-2xl transition-all"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleNext}
                      className="flex-[2] py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl shadow-xl shadow-indigo-500/20 transition-all flex items-center justify-center gap-2"
                    >
                      Confirm & Pay
                    </button>
                  </div>
                </motion.div>
              )}

              {/* STEP 2: EXECUTION & STATUS */}
              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-6 min-h-[300px] flex flex-col justify-center"
                >
                  {/* PENDING SIGNATURE */}
                  {state.phase === STATES.AWAITING_SIGNATURE && (
                    <Loader label="Awaiting Wallet Signature" />
                  )}

                  {/* BROADCASTING / PENDING */}
                  {state.phase === STATES.PENDING && (
                    <div className="space-y-6">
                      <Loader label="Broadcasting to Blockchain" />
                      <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50 text-center">
                        <p className="text-xs text-slate-400 mb-2">Tracking Transaction</p>
                        <a 
                          href={state.polygonscanUrl} 
                          target="_blank" 
                          rel="noreferrer"
                          className="text-sm font-mono text-indigo-400 hover:text-indigo-300 underline underline-offset-4"
                        >
                          {state.txHash?.substring(0, 12)}...{state.txHash?.substring(state.txHash.length - 10)}
                        </a>
                      </div>
                    </div>
                  )}

                  {/* SYNCING */}
                  {state.phase === STATES.SYNCING && (
                    <div className="space-y-6">
                      <div className="flex justify-center">
                        <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500">
                          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-white tracking-tight">Confirmed on Blockchain!</p>
                        <p className="text-sm text-slate-400 mt-1">Synchronizing your dashboard now...</p>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-1 overflow-hidden">
                        <motion.div 
                          className="bg-emerald-500 h-full"
                          initial={{ width: "0%" }}
                          animate={{ width: "100%" }}
                          transition={{ duration: 2, repeat: Infinity }}
                        />
                      </div>
                    </div>
                  )}

                  {/* SUCCESS */}
                  {state.phase === STATES.SUCCESS && (
                    <div className="space-y-6 py-6 text-center">
                      <div className="w-20 h-20 bg-emerald-500 rounded-full mx-auto flex items-center justify-center text-white shadow-2xl shadow-emerald-500/40">
                        <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-2xl font-black text-white">Success!</h3>
                        <p className="text-slate-400 mt-1">Your investment of {amountNum} POL is now live.</p>
                      </div>
                      <div className="p-4 bg-slate-950/50 rounded-3xl border border-slate-800 inline-block w-full text-left space-y-1">
                        <Row label="Status" value="Verified & Synced" color="var(--color-emerald-400)" />
                        <Row label="Receipt" value="View on Polygonscan" mono />
                      </div>
                      <button
                        onClick={onClose}
                        className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl transition-all shadow-xl shadow-emerald-500/20"
                      >
                        Go to Dashboard
                      </button>
                    </div>
                  )}

                  {/* ERROR STATES */}
                  {state.phase === STATES.ERROR && (
                    <div className="space-y-6 text-center">
                      <div className="w-16 h-16 bg-red-500/20 rounded-full mx-auto flex items-center justify-center text-red-500">
                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </div>

                      {state.errorCode === 'SYNC_FAILED' ? (
                        <>
                          <div>
                            <h3 className="text-xl font-bold text-white">Sync Pending</h3>
                            <p className="text-sm text-slate-400 mt-2 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-200">
                              Your POL was successfully sent, but our server missed the update. Click below to retry.
                            </p>
                          </div>
                          <div className="flex flex-col gap-3">
                            <button
                              onClick={retrySync}
                              className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl shadow-xl shadow-indigo-500/20"
                            >
                              Retry Synchronization
                            </button>
                            <button onClick={onClose} className="text-slate-500 text-sm font-bold hover:text-slate-300 underline">
                              Close & Sync Later
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div>
                            <h3 className="text-xl font-bold text-white">Investment Failed</h3>
                            <p className="text-sm text-slate-400 mt-2">{state.errorMessage}</p>
                          </div>
                          <button
                            onClick={reset}
                            className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-2xl transition-all"
                          >
                            Try Again
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
