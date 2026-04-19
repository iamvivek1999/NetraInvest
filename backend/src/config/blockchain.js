/**
 * src/config/blockchain.js
 *
 * Lazy singleton provider/signer/contract setup — ethers v6.
 *
 * Design
 * ──────
 *   All three (provider, signer, contract) are initialized on first use.
 *   The backend starts fine without blockchain env vars — only contract calls
 *   will fail, with a clear 503 error.
 *   requireBlockchainOrStub() is the mandatory gatekeeper for investment routes.
 *
 * Ethers v6 API (no .providers.*, no .utils.*)
 *   new ethers.JsonRpcProvider(url)          — provider
 *   new ethers.Wallet(privateKey, provider)  — signer
 *   new ethers.Contract(address, abi, signer)
 *   ethers.parseEther / formatEther          — top-level helpers
 *   receipt.hash                             — (was receipt.transactionHash in v5)
 */

const { ethers }   = require('ethers');
const env          = require('./env');
const { ApiError } = require('../middleware/errorHandler');

// ABI synced from contracts/artifacts by: npm run sync:abi
const { abi } = require('./abi/InvestmentPlatform.json');

// ─── Chain configuration (single source of truth for Polygon Amoy) ────────────

const CHAIN_CONFIG = {
  chainId:     80002,
  name:        'Polygon Amoy Testnet',
  rpcUrl:      env.ALCHEMY_RPC_URL    || '',
  contractAddr: env.CONTRACT_ADDRESS  || '',
  explorerUrl:  'https://amoy.polygonscan.com',
  explorerTxUrl: (txHash) => `https://amoy.polygonscan.com/tx/${txHash}`,
};

// ─── Lazy singletons ──────────────────────────────────────────────────────────

let _provider = null;
const _signers   = {}; // Cache for role-based signers
const _contracts = {}; // Cache for role-based contract instances

// Role constants matched to Solidity AccessControl
const ROLES = {
  ADMIN:    'admin',
  OPERATOR: 'operator',
  REVIEWER: 'reviewer'
};

// ─── Public helpers ───────────────────────────────────────────────────────────

/**
 * Returns true only if CONTRACT_ADDRESS is a real 40-hex-char Ethereum address.
 * Placeholder values like '0x_fill_after_deployment' return false so the sync
 * and retry jobs skip silently instead of crashing with an ENS error at runtime.
 */
const isValidEthAddress = (addr) =>
  typeof addr === 'string' && /^0x[0-9a-fA-F]{40}$/.test(addr);

/**
 * Returns true if the minimum required blockchain env vars are set AND
 * CONTRACT_ADDRESS is a valid Ethereum address (not a placeholder).
 */
const isBlockchainConfigured = () => {
  if (env.STUB_MODE === 'true') return false;
  // Reject placeholder addresses — ethers v6 would try ENS resolution and crash.
  if (!isValidEthAddress(env.CONTRACT_ADDRESS)) return false;
  return !!(env.ALCHEMY_RPC_URL && env.ADMIN_WALLET_PRIVATE_KEY);
};

/**
 * Asserts that either blockchain is fully configured OR DEV_STUB_BLOCKCHAIN_MODE
 * is explicitly enabled in a non-production environment.
 */
const requireBlockchainOrStub = () => {
  const configured = isBlockchainConfigured();
  const stubMode   = env.DEV_STUB_BLOCKCHAIN_MODE === true;

  if (!configured && !stubMode) {
    throw new ApiError(
      'Blockchain is not configured on this server. ' +
      'Set ALCHEMY_RPC_URL, ADMIN_WALLET_PRIVATE_KEY, and CONTRACT_ADDRESS in your .env. ' +
      'Optional: OPERATOR_WALLET_PRIVATE_KEY, REVIEWER_WALLET_PRIVATE_KEY.',
      503
    );
  }

  return { configured, stubMode };
};

/**
 * Called at server startup to surface blockchain config state immediately.
 */
const validateBlockchainEnvOrWarn = () => {
  const missing = [];
  if (!env.ALCHEMY_RPC_URL)          missing.push('ALCHEMY_RPC_URL');
  if (!env.ADMIN_WALLET_PRIVATE_KEY) missing.push('ADMIN_WALLET_PRIVATE_KEY');
  if (!env.CONTRACT_ADDRESS)         missing.push('CONTRACT_ADDRESS');

  // Detect placeholder — e.g. '0x_fill_after_deployment'
  const hasPlaceholderAddr = env.CONTRACT_ADDRESS && !isValidEthAddress(env.CONTRACT_ADDRESS);

  if (missing.length === 0 && !hasPlaceholderAddr) {
    console.log(`[blockchain] ✅ Configured for ${CHAIN_CONFIG.name} (chainId ${CHAIN_CONFIG.chainId})`);
    console.log(`[blockchain]    Contract: ${env.CONTRACT_ADDRESS}`);

    // Log which roles are using dedicated keys
    if (env.OPERATOR_WALLET_PRIVATE_KEY) {
      console.log('[blockchain]    Role: OPERATOR (dedicated wallet)');
    } else {
      console.log('[blockchain]    Role: OPERATOR (falling back to ADMIN)');
    }

    if (env.REVIEWER_WALLET_PRIVATE_KEY) {
      console.log('[blockchain]    Role: REVIEWER (dedicated wallet)');
    } else {
      console.log('[blockchain]    Role: REVIEWER (falling back to ADMIN)');
    }
  } else if (hasPlaceholderAddr) {
    console.warn('[blockchain] ⚠️  CONTRACT_ADDRESS is a placeholder — deploy the contract first.');
    console.warn(`[blockchain]    Current value: "${env.CONTRACT_ADDRESS}"`);
    console.warn('[blockchain]    Blockchain sync and retry jobs will be SKIPPED until a valid address is set.');
  } else if (env.DEV_STUB_BLOCKCHAIN_MODE) {
    console.warn('[blockchain] ⚠️  DEV_STUB_BLOCKCHAIN_MODE=true — on-chain verification bypassed');
    console.warn(`[blockchain]    Missing: ${missing.join(', ')}`);
  } else {
    console.warn('[blockchain] ⚠️  Blockchain NOT configured — investment endpoints will return 503');
    console.warn(`[blockchain]    Missing env vars: ${missing.join(', ')}`);
  }
};

/**
 * Returns (or lazily creates) the ethers v6 JSON-RPC provider.
 */
const getProvider = () => {
  if (!_provider) {
    if (!env.ALCHEMY_RPC_URL) {
      throw new Error('[blockchain] ALCHEMY_RPC_URL is not set in .env');
    }
    _provider = new ethers.JsonRpcProvider(env.ALCHEMY_RPC_URL);
  }
  return _provider;
};

/**
 * Returns (or lazily creates) a role-based wallet signer.
 * Falls back to ADMIN_WALLET_PRIVATE_KEY if dedicated keys are missing.
 *
 * @param {string} role - one of ROLES (admin, operator, reviewer)
 */
const getSigner = (role = ROLES.ADMIN) => {
  if (!_signers[role]) {
    let key;
    switch (role) {
      case ROLES.OPERATOR:
        key = env.OPERATOR_WALLET_PRIVATE_KEY || env.ADMIN_WALLET_PRIVATE_KEY;
        break;
      case ROLES.REVIEWER:
        key = env.REVIEWER_WALLET_PRIVATE_KEY || env.ADMIN_WALLET_PRIVATE_KEY;
        break;
      default:
        key = env.ADMIN_WALLET_PRIVATE_KEY;
    }

    if (!key) {
      throw new Error(`[blockchain] No private key available for role: ${role}`);
    }
    _signers[role] = new ethers.Wallet(key, getProvider());
  }
  return _signers[role];
};

/**
 * Returns (or lazily creates) the InvestmentPlatform contract connected to
 * the appropriate role-based signer.
 *
 * @param {string} role - one of ROLES (admin, operator, reviewer)
 */
const getContract = (role = ROLES.ADMIN) => {
  if (!_contracts[role]) {
    if (!env.CONTRACT_ADDRESS) {
      throw new Error('[blockchain] CONTRACT_ADDRESS is not set in .env');
    }
    _contracts[role] = new ethers.Contract(env.CONTRACT_ADDRESS, abi, getSigner(role));
  }
  return _contracts[role];
};

/**
 * Returns a read-only contract instance connected to the provider.
 * Use for view functions and event log parsing.
 */
const getReadContract = () =>
  new ethers.Contract(env.CONTRACT_ADDRESS, abi, getProvider());

/**
 * Reset all singletons and caches. Useful in tests or after config reload.
 */
const resetConnections = () => {
  _provider = null;
  Object.keys(_signers).forEach(k => delete _signers[k]);
  Object.keys(_contracts).forEach(k => delete _contracts[k]);
};

module.exports = {
  CHAIN_CONFIG,
  ROLES,
  isValidEthAddress,
  isBlockchainConfigured,
  requireBlockchainOrStub,
  validateBlockchainEnvOrWarn,
  getProvider,
  getSigner,
  getContract,
  getReadContract,
  resetConnections,
};
