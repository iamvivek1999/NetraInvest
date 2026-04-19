import React, { useState, useRef, useEffect } from 'react';
import useWallet from '../hooks/useWallet';
import { motion, AnimatePresence } from 'framer-motion';

const WalletStatus = () => {
  const { 
    account, 
    isConnected, 
    isConnecting, 
    isCorrectChain, 
    formattedBalance, 
    connect, 
    ensureNetwork, 
    disconnect 
  } = useWallet();

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const truncateAddress = (addr) => {
    if (!addr) return '';
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  if (!isConnected) {
    return (
      <button
        onClick={connect}
        disabled={isConnecting}
        className="px-5 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium transition-all duration-200 flex items-center gap-2 active:scale-95 shadow-lg shadow-indigo-500/20"
      >
        {isConnecting ? (
          <>
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Connecting...
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Connect Wallet
          </>
        )}
      </button>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 p-1 pl-4 rounded-full bg-slate-800/50 border border-slate-700 hover:border-slate-600 transition-colors cursor-pointer group"
      >
        <div className="flex flex-col items-end mr-1">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Balance</span>
          <span className="text-sm text-white font-mono leading-none">{formattedBalance} POL</span>
        </div>
        
        <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-slate-700/50 group-hover:bg-slate-700 transition-colors">
          <div className={`w-2 h-2 rounded-full ${isCorrectChain ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]'}`} />
          <span className="text-sm font-medium text-slate-200 font-mono">
            {truncateAddress(account)}
          </span>
          <svg 
            className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute right-0 mt-3 w-64 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden z-50 p-2"
          >
            {!isCorrectChain ? (
              <div className="p-3 mb-2 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                <p className="text-xs text-amber-400 mb-2 font-medium">Wrong Network</p>
                <button
                  onClick={ensureNetwork}
                  className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 text-xs font-bold rounded-lg transition-colors"
                >
                  Switch to Amoy
                </button>
              </div>
            ) : (
              <div className="px-3 py-2 mb-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <p className="text-xs text-emerald-400 font-medium flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                  Polygon Amoy Connected
                </p>
              </div>
            )}

            <button
              onClick={() => {
                disconnect();
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-all group"
            >
              <div className="p-2 bg-slate-800 group-hover:bg-red-500/20 rounded-lg text-slate-400 group-hover:text-red-400 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </div>
              <span className="text-sm font-medium">Disconnect Wallet</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default WalletStatus;
