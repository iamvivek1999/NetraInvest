/**
 * src/services/txVerification.service.js
 *
 * On-chain transaction verification for investor invest() calls.
 *
 * Responsibilities:
 *   verifyInvestmentTx()
 *     1. Fetch the transaction receipt from the RPC node
 *     2. Confirm the tx succeeded (status === 1)
 *     3. Confirm the tx targeted the correct contract address
 *     4. Decode the InvestmentReceived event from the receipt logs
 *     5. Validate campaignKey matches the intended campaign
 *     6. Validate the investor address matches the event's investor field
 *     7. Extract the authoritative amount (from chain, not client claim)
 *
 *   deriveChain()
 *     Infers which chain name to store based on env configuration.
 *     Never trusted from client input.
 *
 * ─── Ethers v5 API Notes ──────────────────────────────────────────────────────
 *   provider.getTransactionReceipt(txHash) → TransactionReceipt | null
 *   receipt.status                         → 1 (success) | 0 (reverted)
 *   receipt.to                             → the contract address the tx called
 *   receipt.logs                           → raw log array
 *   contract.interface.parseLog(log)       → { name, args }
 *   ethers.utils.formatEther(BigNumber)    → decimal string (INR)
 */

const { ethers } = require('ethers');
const { getProvider, getReadContract, isBlockchainConfigured } = require('../config/blockchain');
const env = require('../config/env');

// ─── Chain name derivation ────────────────────────────────────────────────────

/**
 * Derives the canonical chain name from the ALCHEMY_RPC_URL env variable.
 * This is stored on every Investment document and never trusted from the client.
 *
 * @returns {'polygon-amoy'|'polygon'|'hardhat'|'stub'}
 */
const deriveChain = () => {
  if (!isBlockchainConfigured()) return 'stub';

  const url = env.ALCHEMY_RPC_URL.toLowerCase();

  if (url.includes('amoy'))     return 'polygon-amoy';
  if (url.includes('mainnet'))  return 'polygon';
  if (url.includes('mumbai'))   return 'polygon-amoy'; // Mumbai is deprecated, treat as amoy
  if (url.includes('localhost') || url.includes('127.0.0.1')) return 'hardhat';

  // Fallback for any other configured RPC (e.g. QuickNode custom endpoint)
  return 'polygon-amoy';
};

// ─── Main verification function ───────────────────────────────────────────────

/**
 * Verifies an investor's invest() transaction on-chain.
 *
 * Returns a structured result object — never throws.
 * The caller (investment controller) is responsible for acting on the result.
 *
 * @param {object} params
 * @param {string} params.txHash                - 0x-prefixed tx hash (66 chars)
 * @param {string} params.expectedCampaignKey   - bytes32 hex from Campaign.campaignKey
 * @param {string} params.expectedInvestorAddr  - investor's wallet address (0x...)
 *
 * @returns {Promise<VerificationResult>}
 *
 * @typedef {object} VerificationResult
 * @property {boolean} success
 * @property {string}  [error]              - present on failure
 * @property {string}  [amountWei]          - exact wei from event, as string
 * @property {number}  [amountINR]        - INR as float
 * @property {number}  [blockNumber]
 * @property {Date}    [confirmedAt]
 * @property {string}  note                 - description of what was checked
 */
const verifyInvestmentTx = async ({
  txHash,
  expectedCampaignKey,
  expectedInvestorAddr,
}) => {
  // ── Step 1: fetch receipt from node ────────────────────────────────────────

  let receipt;
  try {
    receipt = await getProvider().getTransactionReceipt(txHash);
  } catch (err) {
    return {
      success: false,
      error: `RPC error while fetching receipt: ${err.message}`,
      note: 'receipt fetch failed',
    };
  }

  if (!receipt) {
    return {
      success: false,
      error: 'Transaction not found. It may still be pending — wait for confirmation and retry.',
      note: 'receipt null',
    };
  }

  // ── Step 2: tx must have succeeded ─────────────────────────────────────────

  if (receipt.status !== 1) {
    return {
      success: false,
      error: 'Transaction was reverted (status = 0). The call failed.',
      note: 'tx reverted',
    };
  }

  // ── Step 3: must target the correct contract ────────────────────────────────

  const contractAddr = env.CONTRACT_ADDRESS.toLowerCase();
  if (!receipt.to || receipt.to.toLowerCase() !== contractAddr) {
    return {
      success: false,
      error: `Transaction targeted ${receipt.to || 'unknown'}, expected contract ${env.CONTRACT_ADDRESS}.`,
      note: 'wrong contract',
    };
  }

  // ── Step 4: decode InvestmentReceived event ─────────────────────────────────
  //
  // event InvestmentReceived(
  //   bytes32 indexed campaignKey,
  //   address indexed investor,
  //   uint256 amount,
  //   uint256 totalRaised
  // )

  const readContract = getReadContract();
  let investmentLog = null;

  for (const log of receipt.logs) {
    try {
      const parsed = readContract.interface.parseLog(log);
      if (parsed.name === 'InvestmentReceived') {
        investmentLog = parsed;
        break;
      }
    } catch {
      // parseLog throws on logs from other contracts / different ABI — skip
    }
  }

  if (!investmentLog) {
    return {
      success: false,
      error: 'InvestmentReceived event not found in transaction logs. This transaction may not be an invest() call.',
      note: 'event not found',
    };
  }

  // ── Step 5: validate campaignKey ────────────────────────────────────────────

  // campaignKey is indexed (bytes32) — ethers v5 returns it as a bytes32 hex string
  const eventCampaignKey = investmentLog.args.campaignKey.toLowerCase();
  if (eventCampaignKey !== expectedCampaignKey.toLowerCase()) {
    return {
      success: false,
      error: `Transaction is for campaign key ${investmentLog.args.campaignKey}, not the expected ${expectedCampaignKey}.`,
      note: 'campaignKey mismatch',
    };
  }

  // ── Step 6: validate investor address ───────────────────────────────────────

  const eventInvestor = investmentLog.args.investor.toLowerCase();
  if (eventInvestor !== expectedInvestorAddr.toLowerCase()) {
    return {
      success: false,
      error: `Transaction investor is ${investmentLog.args.investor}, but your wallet is ${expectedInvestorAddr}. ` +
        'You cannot record another investor\'s transaction.',
      note: 'investor mismatch',
    };
  }

  // ── Step 7: extract amount ───────────────────────────────────────────────────

  // investmentLog.args.amount is a BigNumber (ethers v5)
  const amountBN    = investmentLog.args.amount;
  const amountWei   = amountBN.toString();                      // safe string representation
  const amountINR = parseFloat(ethers.utils.formatEther(amountBN)); // INR decimal

  // ── All checks passed ────────────────────────────────────────────────────────

  return {
    success:     true,
    amountWei,
    amountINR,
    blockNumber: receipt.blockNumber,
    confirmedAt: new Date(),
    note:        'on-chain: InvestmentReceived event verified',
  };
};

module.exports = {
  verifyInvestmentTx,
  deriveChain,
};
