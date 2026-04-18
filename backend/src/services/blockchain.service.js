/**
 * src/services/blockchain.service.js
 *
 * High-level blockchain operations for the InvestmentPlatform contract.
 * All functions use tx.wait(1) for confirmation — no event listener dependency.
 *
 * Ethers v5 API notes:
 *   ethers.utils.parseEther(string)     → BigNumber (wei)
 *   ethers.utils.formatEther(BigNumber) → string (INR, decimal)
 *   receipt.transactionHash             → tx hash (v5)
 *   receipt.events / receipt.logs       → decoded events
 *
 * Error wrapping:
 *   Blockchain errors from ethers come as plain Error objects with
 *   .reason (revert reason), .code, .transaction.
 *   We wrap them in ApiError so the global error handler formats them
 *   consistently as JSON API responses.
 */

const { ethers }                      = require('ethers');
const { getContract, isBlockchainConfigured } = require('../config/blockchain');
const { ApiError }                    = require('../middleware/errorHandler');

// ─── Guard ────────────────────────────────────────────────────────────────────

/**
 * Throws a 503 ApiError if the blockchain is not configured.
 * Call at the top of every exported function.
 */
const requireBlockchain = () => {
  if (!isBlockchainConfigured()) {
    throw new ApiError(
      'Blockchain integration is not configured. ' +
        'Set ALCHEMY_RPC_URL, ADMIN_WALLET_PRIVATE_KEY, and CONTRACT_ADDRESS in .env.',
      503
    );
  }
};

// ─── Error normalizer ─────────────────────────────────────────────────────────

/**
 * Converts an ethers.js error into a clean ApiError.
 *
 * Ethers v5 revert reasons surface as:
 *   error.reason        — parsed revert string (most useful)
 *   error.data          — raw revert data
 *   error.code          — e.g. 'CALL_EXCEPTION', 'INSUFFICIENT_FUNDS'
 */
const wrapBlockchainError = (err, context = 'Contract call') => {
  // Already an ApiError (e.g. our own throws) — pass through
  if (err.statusCode) return err;

  // Revert reason from the contract (the most informative)
  const reason =
    err.reason ||
    err.error?.reason ||
    err.error?.message ||
    err.message ||
    'Unknown blockchain error';

  // Known ethers error codes → HTTP status mapping
  const statusMap = {
    INSUFFICIENT_FUNDS:   402,
    CALL_EXCEPTION:       400,
    NETWORK_ERROR:        503,
    TIMEOUT:              504,
    UNPREDICTABLE_GAS_LIMIT: 400,
  };

  const status = statusMap[err.code] || 502;

  return new ApiError(`${context} failed: ${reason}`, status);
};

// ─── activateCampaignOnChain ──────────────────────────────────────────────────

/**
 * Calls contract.createCampaign(...) and waits for 1 confirmation.
 *
 * @param {object} params
 * @param {string} params.campaignKey        bytes32 hex string (0x + 64 chars)
 * @param {string} params.startupWallet      EOA address of the startup
 * @param {number} params.fundingGoalINR   funding goal in INR (e.g. 50)
 * @param {Date}   params.deadline           campaign deadline as JS Date object
 * @param {number} params.milestoneCount     number of active milestones (1–5)
 * @param {number[]} params.milestonePercentages  e.g. [30, 40, 30]
 *
 * @returns {{ txHash, contractAddress, blockNumber }}
 */
const activateCampaignOnChain = async ({
  campaignKey,
  startupWallet,
  fundingGoalINR,
  deadline,
  milestoneCount,
  milestonePercentages,
}) => {
  requireBlockchain();

  // ── Parameter preparation ────────────────────────────────────────────────

  // fundingGoal must be in wei
  const fundingGoalWei = ethers.utils.parseEther(String(fundingGoalINR));

  // deadline must be Unix timestamp in seconds (Solidity block.timestamp is seconds)
  const deadlineUnix = Math.floor(new Date(deadline).getTime() / 1000);

  // milestonePercentages must be exactly 5 elements, unused slots = 0
  const padded = [...milestonePercentages];
  while (padded.length < 5) padded.push(0);

  // ── Contract call ────────────────────────────────────────────────────────

  let tx;
  try {
    const contract = getContract();
    tx = await contract.createCampaign(
      campaignKey,
      startupWallet,
      fundingGoalWei,
      deadlineUnix,
      milestoneCount,
      padded
    );
  } catch (err) {
    throw wrapBlockchainError(err, 'createCampaign');
  }

  // ── Wait for confirmation ────────────────────────────────────────────────

  let receipt;
  try {
    receipt = await tx.wait(1); // 1 block confirmation
  } catch (err) {
    // tx was submitted but reverted on-chain
    throw wrapBlockchainError(err, 'createCampaign confirmation');
  }

  const contract = getContract();

  return {
    txHash:          receipt.transactionHash,
    contractAddress: contract.address,
    blockNumber:     receipt.blockNumber,
  };
};



// ─── setCampaignOpenOnChain ───────────────────────────────────────────────────

/**
 * Calls contract.setCampaignOpen(campaignKey, isOpen).
 * Used for pausing, cancelling, or closing a campaign on-chain.
 *
 * @param {object} params
 * @param {string}  params.campaignKey bytes32 hex string
 * @param {boolean} params.isOpen
 *
 * @returns {{ txHash, blockNumber }}
 */
const setCampaignOpenOnChain = async ({ campaignKey, isOpen }) => {
  requireBlockchain();

  let tx;
  try {
    const contract = getContract();
    tx = await contract.setCampaignOpen(campaignKey, isOpen);
  } catch (err) {
    throw wrapBlockchainError(err, 'setCampaignOpen');
  }

  let receipt;
  try {
    receipt = await tx.wait(1);
  } catch (err) {
    throw wrapBlockchainError(err, 'setCampaignOpen confirmation');
  }

  return {
    txHash:      receipt.transactionHash,
    blockNumber: receipt.blockNumber,
  };
};

module.exports = {
  activateCampaignOnChain,
  setCampaignOpenOnChain,
};
