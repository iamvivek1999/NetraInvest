/**
 * src/hooks/useInvestFlow.js
 *
 * useInvestFlow — state machine hook for the MetaMask-first investment flow.
 *
 * Flow:
 *   idle → awaitingSignature → pending → syncing → success
 *                                                 ↳ error (with structured code)
 *
 * Pre-flight guards (checked before any wallet interaction):
 *   1. window.ethereum present                → NO_METAMASK
 *   2. account connected (accounts[0])        → NOT_CONNECTED
 *   3. chainId === CHAIN_ID (80002 Amoy)       → WRONG_NETWORK
 *   4. CONTRACT_ADDRESS env var not empty      → CONTRACT_NOT_CONFIGURED
 *
 * Error codes (returned via state.errorCode):
 *   NO_METAMASK            — MetaMask extension not installed
 *   NOT_CONNECTED          — wallet not connected to this site
 *   WRONG_NETWORK          — wallet on the wrong chain
 *   CONTRACT_NOT_CONFIGURED — VITE_CONTRACT_ADDRESS is empty
 *   USER_REJECTED          — user dismissed the MetaMask popup (code 4001)
 *   INSUFFICIENT_FUNDS     — wallet balance too low
 *   TX_REVERTED            — tx mined but receipt.status = 0
 *   TX_FAILED              — unexpected send error
 *   SYNC_FAILED            — on-chain confirmed but backend sync error
 *   BACKEND_ERROR          — backend returned a hard error
 *
 * Usage:
 *   const { state, invest, retrySync, preflightError, reset } = useInvestFlow();
 */

import { useState, useCallback, useRef } from 'react';
import { ethers } from 'ethers';
import useWallet from './useWallet';
import { getWriteContract } from '../utils/contract';
import { CONTRACT_ADDRESS, CHAIN_ID, POLYGONSCAN_URL } from '../utils/constants';
import { syncInvestment } from '../api/investments.api';

// ─── State machine states ─────────────────────────────────────────────────────

const STATES = {
  IDLE:              'idle',
  AWAITING_SIGNATURE:'awaitingSignature',
  PENDING:           'pending',
  SYNCING:           'syncing',
  SUCCESS:           'success',
  ERROR:             'error',
};

// ─── Initial state ────────────────────────────────────────────────────────────

const initialState = {
  phase:        STATES.IDLE,
  txHash:       null,      // set once the tx is broadcast
  investment:   null,      // set once backend sync succeeds
  errorCode:    null,
  errorMessage: null,
  polygonscanUrl: null,
  // New estimation fields
  estimatedGas:   null,    // POL string
  totalCost:      null,    // POL string (amount + gas)
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useInvestFlow() {
  const [state, setState] = useState(initialState);

  // Keep a ref to the last known txHash so retrySync can use it
  // even after the state has been reset or overwritten.
  const pendingTxRef = useRef(null);
  const pendingSyncPayloadRef = useRef(null);

  const { account, chainId, getSigner, ensureNetwork, balance } = useWallet();

  // ── Pre-flight check (synchronous, called before any user prompt) ────────────
  const preflight = useCallback(() => {
    if (!window.ethereum) {
      return {
        errorCode:    'NO_METAMASK',
        errorMessage: 'MetaMask is not installed. Install the MetaMask browser extension to invest.',
      };
    }
    if (!account) {
      return {
        errorCode:    'NOT_CONNECTED',
        errorMessage: 'Your wallet is not connected. Click "Connect Wallet" to continue.',
      };
    }
    if (chainId !== CHAIN_ID) {
      return {
        errorCode:    'WRONG_NETWORK',
        errorMessage: `You are on the wrong network (chain ${chainId}). Switch to Polygon Amoy (${CHAIN_ID}).`,
      };
    }
    if (!CONTRACT_ADDRESS) {
      return {
        errorCode:    'CONTRACT_NOT_CONFIGURED',
        errorMessage: 'The smart contract address is not configured. Contact the platform administrator.',
      };
    }
    return null;
  }, [account, chainId]);

  // ── estimateGas() ────────────────────────────────────────────────────────────
  const estimateGas = useCallback(async ({ campaignKey, amount }) => {
    if (!campaignKey || !amount || isNaN(Number(amount))) return null;
    
    try {
      const signer = await getSigner();
      const contract = getWriteContract(signer);
      const valueWei = ethers.parseEther(String(amount));
      
      const provider = signer.provider;
      const { gasPrice } = await provider.getFeeData();
      
      // Estimate units
      const units = await contract.invest.estimateGas(campaignKey, { value: valueWei });
      
      // Add a 20% buffer for safety
      const unitsWithBuffer = (units * 120n) / 100n;
      const gasCostWei = unitsWithBuffer * (gasPrice || 25000000000n);
      
      const gasCostEth = ethers.formatEther(gasCostWei);
      const totalCostEth = ethers.formatEther(valueWei + gasCostWei);

      setState(prev => ({
        ...prev,
        estimatedGas: gasCostEth,
        totalCost:    totalCostEth,
      }));

      return { gasCostEth, totalCostEth, units: unitsWithBuffer };
    } catch (err) {
      console.warn('Gas estimation failed:', err);
      return null;
    }
  }, [getSigner]);

  // ── invest() — the main action ────────────────────────────────────────────────
  const invest = useCallback(async ({ campaignId, campaignKey, amount }) => {
    // 1. Pre-flight
    const blocker = preflight();
    if (blocker) {
      setState({ ...initialState, phase: STATES.ERROR, ...blocker });
      return;
    }

    if (!campaignKey) {
      setState({
        ...initialState,
        phase: STATES.ERROR,
        errorCode: 'CONTRACT_NOT_CONFIGURED',
        errorMessage: 'Campaign is not registered on-chain. Investments cannot be accepted yet.',
      });
      return;
    }

    const valStr = String(amount || '0');
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      setState({
        ...initialState,
        phase: STATES.ERROR,
        errorCode: 'INVALID_AMOUNT',
        errorMessage: 'Please enter a valid positive investment amount.',
      });
      return;
    }

    try {
      await ensureNetwork();
      const signer = await getSigner();
      const contract = getWriteContract(signer);

      // Check balance before sending
      const valueWei = ethers.parseEther(valStr);
      
      // Try estimation to get gas limit
      let gasLimit = undefined;
      try {
        const est = await estimateGas({ campaignKey, amount });
        if (est) gasLimit = est.units;
      } catch (e) { /* ignore */ }

      setState({ ...initialState, phase: STATES.AWAITING_SIGNATURE });

      // Send the transaction
      const tx = await contract.invest(campaignKey, { 
        value:    valueWei,
        gasLimit: gasLimit
      });

      const txHash = tx.hash;
      pendingTxRef.current = txHash;

      setState({
        ...initialState,
        phase:         STATES.PENDING,
        txHash,
        polygonscanUrl: `${POLYGONSCAN_URL}/${txHash}`,
      });

      const receipt = await tx.wait(1);

      if (receipt.status === 0) {
        setState({
          ...initialState,
          phase:         STATES.ERROR,
          txHash,
          errorCode:     'TX_REVERTED',
          errorMessage:  'Your transaction was mined but reverted on-chain. No funds were taken. Please try again.',
          polygonscanUrl:`${POLYGONSCAN_URL}/${txHash}`,
        });
        return;
      }

      const syncPayload = {
        campaignId,
        txHash,
        walletAddress: account.toLowerCase(),
        amount:        Number(amount),
        currency:      'POL',
      };
      pendingSyncPayloadRef.current = syncPayload;

      setState({
        ...initialState,
        phase:         STATES.SYNCING,
        txHash,
        polygonscanUrl:`${POLYGONSCAN_URL}/${txHash}`,
      });

      const { investment, verification } = await syncInvestment(syncPayload);

      setState({
        phase:         STATES.SUCCESS,
        txHash,
        investment,
        verification,
        errorCode:     null,
        errorMessage:  null,
        polygonscanUrl:`${POLYGONSCAN_URL}/${txHash}`,
      });

    } catch (err) {
      const txHash = pendingTxRef.current;

      if (err.code === 4001 || err.code === 'ACTION_REJECTED') {
        setState({
          ...initialState,
          phase:        STATES.ERROR,
          errorCode:    'USER_REJECTED',
          errorMessage: 'You rejected the transaction in MetaMask. No funds were taken.',
        });
        return;
      }

      if (
        err.code === 'INSUFFICIENT_FUNDS' ||
        err.message?.toLowerCase().includes('insufficient funds')
      ) {
        setState({
          ...initialState,
          phase:        STATES.ERROR,
          errorCode:    'INSUFFICIENT_FUNDS',
          errorMessage: 'Your wallet does not have enough POL to cover this investment plus gas fees.',
        });
        return;
      }

      if (txHash && (err.response || err.name === 'AxiosError' || err.message?.includes('sync'))) {
        setState({
          phase:         STATES.ERROR,
          txHash,
          investment:    null,
          errorCode:     'SYNC_FAILED',
          errorMessage:
            'Your investment was confirmed on-chain, but our server could not sync the record. ' +
            'Your funds are safe. Use "Retry Sync" below to try again.',
          polygonscanUrl:`${POLYGONSCAN_URL}/${txHash}`,
        });
        return;
      }

      setState({
        ...initialState,
        phase:         STATES.ERROR,
        txHash:        txHash || null,
        errorCode:     'TX_FAILED',
        errorMessage:  err?.reason || err?.message || 'An unexpected error occurred during the transaction.',
        ...(txHash ? { polygonscanUrl: `${POLYGONSCAN_URL}/${txHash}` } : {}),
      });
    }
  }, [preflight, ensureNetwork, getSigner, account, estimateGas]);

  const retrySync = useCallback(async () => {
    const payload = pendingSyncPayloadRef.current;
    const txHash  = pendingTxRef.current;

    if (!payload || !txHash) {
      setState(prev => ({
        ...prev,
        errorMessage: 'No pending sync payload found. Please refresh and check your investment history.',
      }));
      return;
    }

    setState(prev => ({
      ...prev,
      phase:   STATES.SYNCING,
      txHash,
      polygonscanUrl: `${POLYGONSCAN_URL}/${txHash}`,
    }));

    try {
      const { investment, verification } = await syncInvestment(payload);
      setState({
        phase:         STATES.SUCCESS,
        txHash,
        investment,
        verification,
        errorCode:     null,
        errorMessage:  null,
        polygonscanUrl:`${POLYGONSCAN_URL}/${txHash}`,
      });
    } catch (err) {
      setState(prev => ({
        ...prev,
        phase:        STATES.ERROR,
        txHash,
        errorCode:    'SYNC_FAILED',
        errorMessage:
          'Sync failed again. Your funds are safe on-chain. ' +
          'Please contact support with your tx hash: ' + txHash,
      }));
    }
  }, []);

  const reset = useCallback(() => {
    pendingTxRef.current        = null;
    pendingSyncPayloadRef.current = null;
    setState(initialState);
  }, []);

  return {
    state,
    invest,
    retrySync,
    reset,
    preflight,
    estimateGas,
    STATES,
    preflightError: preflight(),
  };
}
