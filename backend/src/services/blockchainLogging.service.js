/**
 * src/services/blockchainLogging.service.js
 *
 * Provides functions to log transparency records to the specialized
 * InvestmentLogger contract without custodying funds.
 */

// UPDATED FOR BLOCKCHAIN TRANSPARENCY LAYER
const { ethers } = require('ethers');
const env = require('../config/env');

// Minimal ABI required for transparency logging
const loggerAbi = [
  "function logInvestment(uint256 _campaignId, address _investorWallet, string calldata _investorRef, uint256 _amount, string calldata _paymentId, string calldata _paymentProvider) external"
];

/**
 * Pushes metadata to the immutable blockchain ledger gracefully.
 * Resolves asynchronously without halting main execution flows if RPC fails.
 * 
 * @param {Object} params
 * @returns {Promise<{success: boolean, txHash?: string, blockNumber?: number, chainId?: number, error?: string}>}
 */
const logInvestmentToBlockchain = async ({
  campaignId,
  investorRef,
  investorWallet = "0x0000000000000000000000000000000000000000",
  amount,
  paymentId,
  paymentProvider
}) => {
  try {
    // UPDATED FOR LOCAL QA PREP
    if (env.DEV_SKIP_BLOCKCHAIN) {
      console.warn("[BlockchainLogging] Bypassing real blockchain logging due to DEV_SKIP_BLOCKCHAIN flag.");
      return { 
        success: true, 
        txHash: `mock_tx_${Date.now()}`, 
        blockNumber: 999999, 
        chainId: 80002 // Amoy assumed for mocks
      };
    }

    // Graceful exit if transparency layer is turned off / missing configs
    if (!env.ALCHEMY_RPC_URL || !env.ADMIN_WALLET_PRIVATE_KEY || !env.INVESTMENT_LOGGER_CONTRACT_ADDRESS) {
      console.warn("[BlockchainLogging] Missing blockchain configs. Failing transparently.");
      return { success: false, error: "Blockchain transparency layer configs missing (RPC, PrivateKey, or Contract Addr)" };
    }

    const provider = new ethers.providers.JsonRpcProvider(env.ALCHEMY_RPC_URL);
    const wallet = new ethers.Wallet(env.ADMIN_WALLET_PRIVATE_KEY, provider);
    const contract = new ethers.Contract(env.INVESTMENT_LOGGER_CONTRACT_ADDRESS, loggerAbi, wallet);

    const tx = await contract.logInvestment(
      campaignId,
      investorWallet,
      investorRef,
      // Pass amount as string to avoid precision loss if needed, but since it's uint256 we'll parse it as a basic integer or format it. Assuming amount here is scaled or wei. For logging, we'll log raw value.
      // If amount is a decimal float, we need to convert to scaled int. But Razorpay deals in decimals. Let's multiply by 1e18 just for standard blockchain recording keeping standard precision format (or standard ETH scale)
      ethers.utils.parseEther(amount.toString()),
      paymentId,
      paymentProvider
    );

    const receipt = await tx.wait(); // Wait for 1 confirmation

    const network = await provider.getNetwork();

    return {
      success: true,
      txHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber,
      chainId: network.chainId
    };

  } catch (err) {
    console.error("[BlockchainLogging] Failed to log to ledger:", err);
    return {
      success: false,
      error: err.message || "Unknown blockchain execution error"
    };
  }
};

module.exports = {
  logInvestmentToBlockchain
};
