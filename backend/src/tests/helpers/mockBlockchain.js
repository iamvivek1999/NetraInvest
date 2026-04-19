/**
 * src/tests/helpers/mockBlockchain.js
 *
 * Reusable mock factories for blockchain dependencies.
 *
 * Import this BEFORE requiring any service/controller that touches
 * blockchain.js or txVerification.service.js:
 *
 *   jest.mock('../../config/blockchain', () => require('../helpers/mockBlockchain').blockchainMock);
 *
 * Or use the individual builders to craft custom stubs per test.
 */

'use strict';

const { ethers } = require('ethers');

// ─── Fixture values ────────────────────────────────────────────────────────────

const MOCK_TX_HASH      = '0x' + 'a'.repeat(64);
const MOCK_CAMPAIGN_KEY = '0x' + 'b'.repeat(64);
const MOCK_INVESTOR_ADDR = '0x' + 'c'.repeat(40);
const MOCK_CONTRACT_ADDR = '0x' + 'd'.repeat(40);
const MOCK_AMOUNT_WEI   = ethers.parseEther('1.5').toString(); // "1500000000000000000"
const MOCK_AMOUNT_POL   = 1.5;
const MOCK_BLOCK_NUMBER = 12345678;

// ─── Receipt builder ──────────────────────────────────────────────────────────

/**
 * Build a minimal ethers v6-compatible receipt.
 * Includes `to` set to MOCK_CONTRACT_ADDR so the service's Step 3
 * contract address check passes by default.
 *
 * @param {object} overrides - Any field to override
 */
const buildMockReceipt = (overrides = {}) => ({
  hash:        MOCK_TX_HASH,
  to:          MOCK_CONTRACT_ADDR,  // matches env.CONTRACT_ADDRESS in verifyInvestmentTx Step 3
  status:      1,
  blockNumber: MOCK_BLOCK_NUMBER,
  gasUsed:     BigInt(21000),
  logs:        [], // populated by callers using buildMockInvestmentLog()
  ...overrides,
});

/**
 * Build a mock InvestmentReceived event log that ethers' Contract.parseLog can return.
 * This matches the ABI signature:
 *   InvestmentReceived(bytes32 indexed campaignKey, address indexed investor, uint256 amount)
 */
const buildMockInvestmentLog = (overrides = {}) => {
  const base = {
    name:  'InvestmentReceived',
    args: {
      campaignKey: MOCK_CAMPAIGN_KEY,
      investor:    MOCK_INVESTOR_ADDR,
      amount:      BigInt(MOCK_AMOUNT_WEI),
    },
  };
  // Deep merge args separately so callers can override individual args
  return {
    ...base,
    ...overrides,
    args: {
      ...base.args,
      ...(overrides.args || {}),
    },
  };
};

// ─── Provider mock ────────────────────────────────────────────────────────────

/**
 * Build a mock provider with a stubbed getTransactionReceipt.
 *
 * @param {object} receiptOverride  - Passed straight to buildMockReceipt
 */
const buildMockProvider = (receiptOverride = {}) => ({
  getTransactionReceipt: jest.fn().mockResolvedValue(buildMockReceipt(receiptOverride)),
  getBlockNumber:        jest.fn().mockResolvedValue(MOCK_BLOCK_NUMBER + 10),
  getLogs:               jest.fn().mockResolvedValue([]),
});

// ─── Contract mock ────────────────────────────────────────────────────────────

/**
 * Build a mock contract instance.
 *
 * @param {object} overrides - Additional methods / event factories
 */
const buildMockContract = (overrides = {}) => ({
  parseLog:  jest.fn().mockReturnValue(buildMockInvestmentLog()),
  interface: { parseLog: jest.fn().mockReturnValue(buildMockInvestmentLog()) },
  releaseMilestone: jest.fn().mockResolvedValue({
    hash: MOCK_TX_HASH, wait: jest.fn().mockResolvedValue({ hash: MOCK_TX_HASH, status: 1, blockNumber: MOCK_BLOCK_NUMBER }),
  }),
  approveMilestoneEvidence: jest.fn().mockResolvedValue({
    hash: MOCK_TX_HASH, wait: jest.fn().mockResolvedValue({ hash: MOCK_TX_HASH, status: 1, blockNumber: MOCK_BLOCK_NUMBER }),
  }),
  submitMilestoneEvidenceHash: jest.fn().mockResolvedValue({
    hash: MOCK_TX_HASH, wait: jest.fn().mockResolvedValue({ hash: MOCK_TX_HASH, status: 1, blockNumber: MOCK_BLOCK_NUMBER }),
  }),
  createCampaign: jest.fn().mockResolvedValue({
    hash: MOCK_TX_HASH, wait: jest.fn().mockResolvedValue({ hash: MOCK_TX_HASH, status: 1, blockNumber: MOCK_BLOCK_NUMBER }),
  }),
  queryFilter: jest.fn().mockResolvedValue([]),
  filters:     {
    InvestmentReceived:         jest.fn().mockReturnValue({}),
    MilestoneEvidenceSubmitted: jest.fn().mockReturnValue({}),
    MilestoneApproved:          jest.fn().mockReturnValue({}),
    MilestoneReleased:          jest.fn().mockReturnValue({}),
    CampaignCreated:            jest.fn().mockReturnValue({}),
  },
  ...overrides,
});

// ─── blockchain.js module mock ────────────────────────────────────────────────
// Use with: jest.mock('../../config/blockchain', () => ({ ...blockchainModuleMock }));

const blockchainModuleMock = {
  ROLES: { ADMIN: 'admin', OPERATOR: 'operator', REVIEWER: 'reviewer' },
  CHAIN_CONFIG: {
    chainId: 80002,
    name:    'Polygon Amoy Testnet (Mock)',
    rpcUrl:  'http://localhost:8545',
    contractAddr: MOCK_CONTRACT_ADDR,
    explorerUrl:  'https://amoy.polygonscan.com',
    explorerTxUrl: (hash) => `https://amoy.polygonscan.com/tx/${hash}`,
  },
  isBlockchainConfigured:    jest.fn().mockReturnValue(true),
  requireBlockchainOrStub:   jest.fn().mockReturnValue({ configured: true, stubMode: false }),
  validateBlockchainEnvOrWarn: jest.fn(),
  getProvider:    jest.fn().mockReturnValue(buildMockProvider()),
  getSigner:      jest.fn().mockReturnValue({ address: MOCK_CONTRACT_ADDR }),
  getContract:    jest.fn().mockReturnValue(buildMockContract()),
  getReadContract: jest.fn().mockReturnValue(buildMockContract()),
  resetConnections: jest.fn(),
};

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  // Fixtures
  MOCK_TX_HASH,
  MOCK_CAMPAIGN_KEY,
  MOCK_INVESTOR_ADDR,
  MOCK_CONTRACT_ADDR,
  MOCK_AMOUNT_WEI,
  MOCK_AMOUNT_POL,
  MOCK_BLOCK_NUMBER,

  // Builders
  buildMockReceipt,
  buildMockInvestmentLog,
  buildMockProvider,
  buildMockContract,

  // Full module mock (pass to jest.mock factory)
  blockchainModuleMock,
};
