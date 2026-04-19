/**
 * src/utils/constants.js
 * Centralised access to all VITE_ env vars.
 * Import from here instead of using import.meta.env directly.
 */

// Default to same-origin `/api/v1` so Vite’s dev proxy (see vite.config.js) forwards to
// the backend — avoids CORS and works for both localhost and 127.0.0.1.
// Set VITE_API_URL when the API is on another host (e.g. production API domain).
export const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

export const CONTRACT_ADDRESS =
  import.meta.env.VITE_CONTRACT_ADDRESS || '';

export const CHAIN_ID =
  parseInt(import.meta.env.VITE_CHAIN_ID || '80002', 10);

// UPDATED FOR DEPLOYMENT PREP: Environment-aware explorer link
export const POLYGONSCAN_URL =
  import.meta.env.VITE_POLYGONSCAN_URL || 
  (CHAIN_ID === 137 ? 'https://polygonscan.com/tx' : 'https://amoy.polygonscan.com/tx');

export const APP_NAME =
  import.meta.env.VITE_APP_NAME || 'Enigma Invest';

// UPDATED FOR DEPLOYMENT PREP: 
// STUB_MODE is strictly for dev/demo. Force false if not explicitly true.
export const STUB_MODE =
  import.meta.env.VITE_STUB_MODE === 'true';

// Polygon Amoy testnet chain params (used by wallet_addEthereumChain)
export const AMOY_CHAIN_PARAMS = {
  chainId:         '0x13882', // 80002 in hex
  chainName:       'Polygon Amoy Testnet',
  nativeCurrency:  { name: 'POL', symbol: 'POL', decimals: 18 },
  rpcUrls:         ['https://rpc-amoy.polygon.technology/'],
  blockExplorerUrls: ['https://amoy.polygonscan.com/'],
};
