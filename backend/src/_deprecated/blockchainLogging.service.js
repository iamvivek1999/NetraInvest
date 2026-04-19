/**
 * src/services/blockchainLogging.service.js
 *
 * Legacy transparency logging service — part of the deprecated Razorpay path.
 * Kept for off-chain audit history but no longer called by the main investment flow.
 *
 * All routes that invoke this are served under /api/v1/payments-legacy with
 * a Deprecation header. Do not use in new code.
 *
 * Ethers v6 API (updated from v5):
 *   new ethers.JsonRpcProvider(url)   — (was ethers.providers.JsonRpcProvider)
 *   ethers.parseEther(string)         — (was ethers.utils.parseEther)
 *   receipt.hash                      — (was receipt.transactionHash)
 *   network.chainId                   — bigint in v6 (was number in v5)
 */

const { ethers } = require('ethers');
const env = require('../config/env');

// Minimal ABI for the legacy transparency logging contract
const loggerAbi = [
  'function logInvestment(uint256 _campaignId, address _investorWallet, string calldata _investorRef, uint256 _amount, string calldata _paymentId, string calldata _paymentProvider) external'
];

/**
 * @deprecated — Part of legacy Razorpay transparency path.
 *   Use the main investment controller with on-chain verification instead.
 *
 * Pushes metadata to the immutable blockchain ledger.
 * Resolves without halting if RPC fails (graceful degradation for legacy path only).
 *
 * @param {Object} params
 * @returns {Promise<{success: boolean, txHash?: string, blockNumber?: number, chainId?: number, error?: string}>}
 */
const logInvestmentToBlockchain = async ({
  campaignId,
  investorRef,
  investorWallet = '0x0000000000000000000000000000000000000000',
  amount,
  paymentId,
  paymentProvider,
}) => {
  try {
    if (env.DEV_SKIP_BLOCKCHAIN) {
      console.warn('[BlockchainLogging] [DEPRECATED] Bypassing via DEV_SKIP_BLOCKCHAIN flag.');
      return {
        success:     true,
        txHash:      `mock_legacy_tx_${Date.now()}`,
        blockNumber: 999999,
        chainId:     80002,
      };
    }

    if (!env.ALCHEMY_RPC_URL || !env.ADMIN_WALLET_PRIVATE_KEY || !env.INVESTMENT_LOGGER_CONTRACT_ADDRESS) {
      console.warn('[BlockchainLogging] [DEPRECATED] Missing configs. Skipping gracefully.');
      return { success: false, error: 'Blockchain transparency layer configs missing' };
    }

    // ethers v6: JsonRpcProvider (no .providers. namespace)
    const provider = new ethers.JsonRpcProvider(env.ALCHEMY_RPC_URL);
    const wallet   = new ethers.Wallet(env.ADMIN_WALLET_PRIVATE_KEY, provider);
    const contract = new ethers.Contract(env.INVESTMENT_LOGGER_CONTRACT_ADDRESS, loggerAbi, wallet);

    const tx = await contract.logInvestment(
      campaignId,
      investorWallet,
      investorRef,
      ethers.parseEther(amount.toString()), // v6: top-level (was ethers.utils.parseEther)
      paymentId,
      paymentProvider
    );

    const receipt = await tx.wait();

    const network = await provider.getNetwork();

    return {
      success:     true,
      txHash:      receipt.hash,                    // v6: receipt.hash (was .transactionHash)
      blockNumber: receipt.blockNumber,
      chainId:     Number(network.chainId),         // v6: chainId is bigint — convert for JSON
    };

  } catch (err) {
    console.error('[BlockchainLogging] [DEPRECATED] Failed to log to ledger:', err);
    return {
      success: false,
      error:   err.shortMessage || err.message || 'Unknown blockchain error',
    };
  }
};

module.exports = {
  logInvestmentToBlockchain,
};
