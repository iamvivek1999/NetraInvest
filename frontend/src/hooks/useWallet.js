/**
 * src/hooks/useWallet.js
 *
 * React hook that encapsulates MetaMask wallet connection and network management.
 *
 * Features:
 *   - Detects whether window.ethereum (MetaMask) is present
 *   - Tracks account address and current chain ID reactively
 *   - connect()          — requests eth_requestAccounts
 *   - ensureNetwork()    — switches to / adds Polygon Amoy
 *   - getSigner()        — returns an ethers v6 BrowserProvider signer
 *   - disconnect()       — clears local state (MetaMask itself stays connected)
 *   - Listens to accountsChanged / chainChanged events from MetaMask
 *
 * Environment variables used (via src/utils/constants.js):
 *   VITE_CHAIN_ID        — target chain ID (default 80002 = Amoy)
 *   VITE_POLYGONSCAN_URL — block explorer base URL
 */

import { useState, useEffect, useCallback } from 'react';
import { ethers }                            from 'ethers';
import { CHAIN_ID, AMOY_CHAIN_PARAMS }       from '../utils/constants';

// ─── State shape exposed by the hook ─────────────────────────────────────────
// {
//   isInstalled:    bool   — window.ethereum present
//   isConnected:    bool   — at least one account linked
//   account:        string — lowercase 0x… address (or null)
//   chainId:        number — current chain ID (or null)
//   isCorrectChain: bool   — chainId === VITE_CHAIN_ID
//   isConnecting:   bool   — waiting for MetaMask approval
//   error:          string — last error message (or null)
//   connect:        fn
//   ensureNetwork:  fn
//   disconnect:     fn
//   getSigner:      fn     — async, returns ethers.Signer
// }

export default function useWallet() {
  const [account,      setAccount]      = useState(null);
  const [chainId,      setChainId]      = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error,        setError]        = useState(null);

  const isInstalled    = typeof window !== 'undefined' && Boolean(window.ethereum);
  const isConnected    = Boolean(account);
  const isCorrectChain = chainId === CHAIN_ID;

  // ── Read current state from MetaMask on mount ────────────────────────────
  useEffect(() => {
    if (!isInstalled) return;

    const eth = window.ethereum;

    // Rehydrate from existing connection (if user already approved)
    eth.request({ method: 'eth_accounts' })
      .then((accounts) => {
        if (accounts.length > 0) setAccount(accounts[0].toLowerCase());
      })
      .catch(() => {});

    eth.request({ method: 'eth_chainId' })
      .then((hex) => setChainId(parseInt(hex, 16)))
      .catch(() => {});

    // ── Event listeners ───────────────────────────────────────────────────
    const onAccountsChanged = (accounts) => {
      setAccount(accounts[0]?.toLowerCase() ?? null);
    };

    const onChainChanged = (hex) => {
      setChainId(parseInt(hex, 16));
    };

    eth.on('accountsChanged', onAccountsChanged);
    eth.on('chainChanged',    onChainChanged);

    return () => {
      eth.removeListener('accountsChanged', onAccountsChanged);
      eth.removeListener('chainChanged',    onChainChanged);
    };
  }, [isInstalled]);

  // ── connect() ────────────────────────────────────────────────────────────
  const connect = useCallback(async () => {
    if (!isInstalled) {
      setError('MetaMask is not installed. Please install the MetaMask browser extension.');
      return null;
    }
    setError(null);
    setIsConnecting(true);
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const addr = accounts[0]?.toLowerCase();
      setAccount(addr);
      const hex = await window.ethereum.request({ method: 'eth_chainId' });
      setChainId(parseInt(hex, 16));
      return addr;
    } catch (err) {
      const msg =
        err.code === 4001
          ? 'You rejected the connection request.'
          : err.message || 'Failed to connect wallet.';
      setError(msg);
      return null;
    } finally {
      setIsConnecting(false);
    }
  }, [isInstalled]);

  // ── ensureNetwork() ──────────────────────────────────────────────────────
  // Switches MetaMask to Polygon Amoy. If the chain is not yet added to
  // MetaMask, uses wallet_addEthereumChain to add it first.
  const ensureNetwork = useCallback(async () => {
    if (!isInstalled) {
      throw new Error('MetaMask is not installed.');
    }
    const targetHex = `0x${CHAIN_ID.toString(16)}`;
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: targetHex }],
      });
      setChainId(CHAIN_ID);
    } catch (err) {
      if (err.code === 4902) {
        // Chain not added yet → add it
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [AMOY_CHAIN_PARAMS],
        });
        setChainId(CHAIN_ID);
      } else if (err.code === 4001) {
        throw new Error('You rejected the network switch.');
      } else {
        throw new Error(err.message || 'Failed to switch network.');
      }
    }
  }, [isInstalled]);

  // ── getSigner() ──────────────────────────────────────────────────────────
  const getSigner = useCallback(async () => {
    if (!isInstalled) throw new Error('MetaMask is not installed.');
    if (!isConnected)  throw new Error('No wallet connected.');
    const provider = new ethers.BrowserProvider(window.ethereum);
    return provider.getSigner();
  }, [isInstalled, isConnected]);

  // ── disconnect() ─────────────────────────────────────────────────────────
  // NOTE: MetaMask doesn't expose a true "disconnect" method from JS.
  // This clears the local hook state only; the user must also disconnect
  // from MetaMask's own UI if they want to fully revoke permission.
  const disconnect = useCallback(() => {
    setAccount(null);
    setChainId(null);
    setError(null);
  }, []);

  return {
    isInstalled,
    isConnected,
    isCorrectChain,
    isConnecting,
    account,
    chainId,
    error,
    connect,
    ensureNetwork,
    getSigner,
    disconnect,
  };
}
