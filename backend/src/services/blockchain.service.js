/**
 * src/services/blockchain.service.js
 *
 * High-level blockchain operations for the InvestmentPlatform contract.
 * All functions use tx.wait(1) for confirmation — no event listener dependency.
 *
 * Ethers v6 API notes
 * ────────────────────
 *   ethers.parseEther(string)     → bigint (wei)
 *   ethers.formatEther(bigint)    → string (decimal POL)
 *   receipt.hash                  → tx hash (v5 was receipt.transactionHash)
 *   receipt.blockNumber           → same in v5 and v6
 *   err.shortMessage              → primary revert reason in v6
 *                                   (v5 was err.reason)
 *
 * Error wrapping
 * ──────────────
 *   Blockchain errors from ethers v6 surface as ActionRejectedError,
 *   CallExceptionError etc. We normalize them into ApiError so the global
 *   error handler formats them consistently as JSON API responses.
 */

const { ethers }                      = require('ethers');
const { getContract, isBlockchainConfigured, ROLES } = require('../config/blockchain');
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
 * Converts an ethers v6 error into a clean ApiError.
 *
 * Ethers v6 revert reasons surface as:
 *   err.shortMessage  — concise, machine-readable revert string (preferred)
 *   err.reason        — alias, sometimes present
 *   err.info?.error?.message — nested RPC message
 *   err.message       — fallback
 *
 * Known ethers v6 error codes (err.code):
 *   ACTION_REJECTED       — user rejected in wallet
 *   INSUFFICIENT_FUNDS    — not enough gas
 *   CALL_EXCEPTION        — contract revert
 *   NETWORK_ERROR         — RPC unreachable
 *   TIMEOUT               — RPC timeout
 *   UNPREDICTABLE_GAS_LIMIT — gas estimation failed (usually revert)
 */
const wrapBlockchainError = (err, context = 'Contract call') => {
  // Already an ApiError (e.g. our own throws) — pass through
  if (err.statusCode) return err;

  // v6: shortMessage is the cleanest revert reason
  const reason =
    err.shortMessage   ||
    err.reason         ||
    err.info?.error?.message ||
    err.message        ||
    'Unknown blockchain error';

  // Error code → HTTP status mapping (v6 codes)
  const statusMap = {
    ACTION_REJECTED:          400,
    INSUFFICIENT_FUNDS:       402,
    CALL_EXCEPTION:           400,
    NETWORK_ERROR:            503,
    TIMEOUT:                  504,
    UNPREDICTABLE_GAS_LIMIT:  400,
  };

  const status = statusMap[err.code] || 502;

  return new ApiError(`${context} failed: ${reason}`, status);
};

// ─── activateCampaignOnChain ──────────────────────────────────────────────────

/**
 * Calls contract.createCampaign(...) and waits for 1 confirmation.
 *
 * @param {object} params
 * @param {string} params.campaignKey              bytes32 hex string (0x + 64 chars)
 * @param {string} params.startupWallet            EOA address of the startup
 * @param {string|number} params.fundingGoalPOL    funding goal in POL decimal (e.g. "2.5")
 * @param {Date}   params.deadline                 campaign deadline as JS Date object
 * @param {number} params.milestoneCount           number of active milestones (1–5)
 * @param {number[]} params.milestonePercentages   e.g. [30, 40, 30]
 *
 * @returns {{ txHash, contractAddress, blockNumber }}
 */
const activateCampaignOnChain = async ({
  campaignKey,
  startupWallet,
  fundingGoalPOL,
  deadline,
  milestoneCount,
  milestonePercentages,
}) => {
  requireBlockchain();

  // ── Parameter preparation ────────────────────────────────────────────────

  // ethers v6: parseEther returns bigint (not BigNumber)
  const fundingGoalWei = ethers.parseEther(String(fundingGoalPOL));

  // Solidity block.timestamp is Unix seconds
  const deadlineUnix = Math.floor(new Date(deadline).getTime() / 1000);

  // Contract expects exactly 5 milestone percentages; unused slots = 0
  const padded = [...milestonePercentages];
  while (padded.length < 5) padded.push(0);

  // ── Contract call ────────────────────────────────────────────────────────

  let tx;
  try {
    const contract = getContract(ROLES.ADMIN);
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
    throw wrapBlockchainError(err, 'createCampaign confirmation');
  }

  return {
    txHash:          receipt.hash,           // v6: receipt.hash (v5 was .transactionHash)
    contractAddress: env && env.CONTRACT_ADDRESS
                     ? env.CONTRACT_ADDRESS
                     : getContract().target, // v6: contract.target (v5 was .address)
    blockNumber:     receipt.blockNumber,
  };
};

// ─── setCampaignOpenOnChain ───────────────────────────────────────────────────

/**
 * Calls contract.setCampaignOpen(campaignKey, isOpen).
 * Used for pausing, cancelling, or closing a campaign on-chain.
 *
 * @param {object}  params
 * @param {string}  params.campaignKey  bytes32 hex string
 * @param {boolean} params.isOpen
 *
 * @returns {{ txHash, blockNumber }}
 */
const setCampaignOpenOnChain = async ({ campaignKey, isOpen }) => {
  requireBlockchain();

  let tx;
  try {
    const contract = getContract(ROLES.ADMIN);
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
    txHash:      receipt.hash,
    blockNumber: receipt.blockNumber,
  };
};

// ─── submitEvidenceHashOnChain ────────────────────────────────────────────────

/**
 * Called by evidenceAnchor.service — admin signs the tx on behalf of the startup.
 *
 * NOTE: Prefer using evidenceAnchor.service.anchorBundle() which wraps this
 * function with event verification and MongoDB updates.
 * Use this directly only for low-level testing.
 *
 * @param {object} params
 * @param {string} params.campaignKey      0x-prefixed bytes32
 * @param {number} params.milestoneIndex   0-based
 * @param {string} params.evidenceHash     0x-prefixed bytes32
 * @param {string} params.summaryHash      0x-prefixed bytes32
 * @returns {{ txHash, blockNumber }}
 */
const submitEvidenceHashOnChain = async ({
  campaignKey, milestoneIndex, evidenceHash, summaryHash,
}) => {
  requireBlockchain();

  let tx;
  try {
    const contract = getContract(ROLES.OPERATOR);
    tx = await contract.submitMilestoneEvidenceHash(
      campaignKey,
      milestoneIndex,
      evidenceHash,
      summaryHash
    );
  } catch (err) {
    throw wrapBlockchainError(err, 'submitMilestoneEvidenceHash');
  }

  let receipt;
  try {
    receipt = await tx.wait(1);
  } catch (err) {
    throw wrapBlockchainError(err, 'submitMilestoneEvidenceHash confirmation');
  }

  return { txHash: receipt.hash, blockNumber: receipt.blockNumber };
};

// ─── approveMilestoneOnChain ──────────────────────────────────────────────────

/**
 * Admin approves milestone evidence — emits MilestoneEvidenceApproved.
 * Milestone must be in Submitted status on-chain.
 *
 * @param {object} params
 * @param {string} params.campaignKey
 * @param {number} params.milestoneIndex
 * @returns {{ txHash, blockNumber }}
 */
const approveMilestoneOnChain = async ({ campaignKey, milestoneIndex }) => {
  requireBlockchain();

  let tx;
  try {
    const contract = getContract(ROLES.REVIEWER);
    tx = await contract.approveMilestoneEvidence(campaignKey, milestoneIndex);
  } catch (err) {
    throw wrapBlockchainError(err, 'approveMilestoneEvidence');
  }

  let receipt;
  try {
    receipt = await tx.wait(1);
  } catch (err) {
    throw wrapBlockchainError(err, 'approveMilestoneEvidence confirmation');
  }

  return { txHash: receipt.hash, blockNumber: receipt.blockNumber };
};

// ─── rejectMilestoneOnChain ───────────────────────────────────────────────────

/**
 * Admin rejects milestone evidence — emits MilestoneEvidenceRejected.
 * Milestone must be in Submitted status on-chain.
 * After rejection the startup can resubmit (status resets to NotSubmitted on-chain).
 *
 * @param {object} params
 * @param {string} params.campaignKey
 * @param {number} params.milestoneIndex
 * @param {string} params.reason          Short rejection reason (logged on-chain via event)
 * @returns {{ txHash, blockNumber }}
 */
const rejectMilestoneOnChain = async ({ campaignKey, milestoneIndex, reason }) => {
  requireBlockchain();

  let tx;
  try {
    const contract = getContract(ROLES.REVIEWER);
    tx = await contract.rejectMilestoneEvidence(campaignKey, milestoneIndex, reason || '');
  } catch (err) {
    throw wrapBlockchainError(err, 'rejectMilestoneEvidence');
  }

  let receipt;
  try {
    receipt = await tx.wait(1);
  } catch (err) {
    throw wrapBlockchainError(err, 'rejectMilestoneEvidence confirmation');
  }

  return { txHash: receipt.hash, blockNumber: receipt.blockNumber };
};

// ─── releaseMilestoneOnChain ──────────────────────────────────────────────────

/**
 * Admin releases milestone funds — emits MilestoneReleased.
 * Milestone must be in Approved status on-chain.
 * Transfers tranche to campaign.startupWallet automatically.
 *
 * @param {object} params
 * @param {string} params.campaignKey
 * @param {number} params.milestoneIndex
 * @returns {{ txHash, blockNumber, amountWei }}
 */
const releaseMilestoneOnChain = async ({ campaignKey, milestoneIndex }) => {
  requireBlockchain();

  let tx;
  try {
    const contract = getContract(ROLES.REVIEWER);
    tx = await contract.releaseMilestone(campaignKey, milestoneIndex);
  } catch (err) {
    throw wrapBlockchainError(err, 'releaseMilestone');
  }

  let receipt;
  try {
    receipt = await tx.wait(1);
  } catch (err) {
    throw wrapBlockchainError(err, 'releaseMilestone confirmation');
  }

  // Parse MilestoneReleased event to get the actual amount transferred
  let amountWei = null;
  try {
    const contract = getContract(ROLES.REVIEWER);
    for (const log of receipt.logs) {
      try {
        const parsed = contract.interface.parseLog(log);
        if (parsed && parsed.name === 'MilestoneReleased') {
          amountWei = parsed.args.amount.toString();
          break;
        }
      } catch { /* non-matching log */ }
    }
  } catch { /* event parsing is best-effort */ }

  return { txHash: receipt.hash, blockNumber: receipt.blockNumber, amountWei };
};

module.exports = {
  activateCampaignOnChain,
  setCampaignOpenOnChain,
  submitEvidenceHashOnChain,
  approveMilestoneOnChain,
  rejectMilestoneOnChain,
  releaseMilestoneOnChain,
};
