require('@nomicfoundation/hardhat-toolbox');
require('dotenv').config();

// ─── Required for testnet deployment ─────────────────────────────────────────
// Leave blank for local development — hardhat network uses its own accounts
const AMOY_RPC_URL       = process.env.AMOY_RPC_URL       || '';
const ADMIN_PRIVATE_KEY  = process.env.ADMIN_PRIVATE_KEY  || '0x' + '0'.repeat(64);
const POLYGONSCAN_API_KEY = process.env.POLYGONSCAN_API_KEY || '';

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: '0.8.24',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200, // balanced between deployment cost and call cost
      },
    },
  },

  networks: {
    // ── Local (default) ────────────────────────────────────────────────────
    hardhat: {
      chainId: 31337,
      // Pre-funded accounts available automatically — no setup needed
    },

    // ── Polygon Amoy Testnet ───────────────────────────────────────────────
    // Mumbai was deprecated in April 2024. Amoy is the current Polygon testnet.
    // Faucet: https://faucet.polygon.technology/
    // Explorer: https://amoy.polygonscan.com/
    amoy: {
      url:      AMOY_RPC_URL,
      accounts: ADMIN_PRIVATE_KEY !== '0x' + '0'.repeat(64) ? [ADMIN_PRIVATE_KEY] : [],
      chainId:  80002,
    },
  },

  etherscan: {
    apiKey: {
      polygonAmoy: POLYGONSCAN_API_KEY,
    },
    customChains: [
      {
        network:   'polygonAmoy',
        chainId:   80002,
        urls: {
          apiURL:     'https://api-amoy.polygonscan.com/api',
          browserURL: 'https://amoy.polygonscan.com/',
        },
      },
    ],
  },

  gasReporter: {
    enabled:  process.env.REPORT_GAS === 'true',
    currency: 'USD',
    // coinmarketcap: process.env.COINMARKETCAP_API_KEY,
  },

  paths: {
    sources:   './contracts',
    tests:     './test',
    cache:     './cache',
    artifacts: './artifacts',
  },
};
