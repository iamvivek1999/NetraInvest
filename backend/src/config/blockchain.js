/**
 * src/config/blockchain.js
 *
 * Lazy singleton provider/signer/contract setup for ethers v5.
 *
 * Design:
 *   - All three (provider, signer, contract) are initialized on first use.
 *   - The backend starts fine without blockchain env vars — only contract
 *     calls will fail, with a clear 503 error pointing to missing config.
 *   - isBlockchainConfigured() lets callers gate functionality gracefully.
 *
 * Ethers v5 API (matches backend package.json ethers@^5.7.2):
 *   - ethers.providers.JsonRpcProvider
 *   - new ethers.Wallet(privateKey, provider)
 *   - new ethers.Contract(address, abi, signer)
 *   - ethers.utils.parseEther / formatEther
 */

const { ethers } = require('ethers');
const env        = require('./env');

// ABI is synced from contracts/artifacts by: npm run sync:abi
const { abi }    = require('./abi/InvestmentPlatform.json');

// ─── Lazy singletons ──────────────────────────────────────────────────────────

let _provider = null;
let _signer   = null;
let _contract = null;

// ─── Public helpers ───────────────────────────────────────────────────────────

/**
 * Returns true if all three blockchain env vars are set AND we are not in STUB_MODE.
 * Used to gate contract calls gracefully in controllers.
 */
const isBlockchainConfigured = () => {
  if (env.STUB_MODE === 'true') return false;
  return !!(env.ALCHEMY_RPC_URL && env.ADMIN_WALLET_PRIVATE_KEY && env.CONTRACT_ADDRESS);
};
/**
 * Returns (or lazily creates) the JSON-RPC provider.
 * Compatible with Alchemy, Infura, QuickNode, or any JSON-RPC endpoint.
 */
const getProvider = () => {
  if (!_provider) {
    if (!env.ALCHEMY_RPC_URL) {
      throw new Error('[blockchain] ALCHEMY_RPC_URL is not set in .env');
    }
    _provider = new ethers.providers.JsonRpcProvider(env.ALCHEMY_RPC_URL);
  }
  return _provider;
};

/**
 * Returns (or lazily creates) the admin wallet signer.
 * This is the backend operator that signs createCampaign and releaseMilestone.
 */
const getSigner = () => {
  if (!_signer) {
    if (!env.ADMIN_WALLET_PRIVATE_KEY) {
      throw new Error('[blockchain] ADMIN_WALLET_PRIVATE_KEY is not set in .env');
    }
    _signer = new ethers.Wallet(env.ADMIN_WALLET_PRIVATE_KEY, getProvider());
  }
  return _signer;
};

/**
 * Returns (or lazily creates) the InvestmentPlatform contract instance.
 * Connected to the admin signer — only call admin-only functions through this.
 */
const getContract = () => {
  if (!_contract) {
    if (!env.CONTRACT_ADDRESS) {
      throw new Error('[blockchain] CONTRACT_ADDRESS is not set in .env');
    }
    _contract = new ethers.Contract(env.CONTRACT_ADDRESS, abi, getSigner());
  }
  return _contract;
};

/**
 * Returns a read-only contract instance connected to the provider.
 * Use for view functions (getCampaign, getTotalRaised, getInvestment).
 */
const getReadContract = () =>
  new ethers.Contract(env.CONTRACT_ADDRESS, abi, getProvider());

/**
 * Reset all singletons. Useful in tests or after config changes.
 */
const resetConnections = () => {
  _provider = null;
  _signer   = null;
  _contract = null;
};

module.exports = {
  isBlockchainConfigured,
  getProvider,
  getSigner,
  getContract,
  getReadContract,
  resetConnections,
};
