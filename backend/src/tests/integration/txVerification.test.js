/**
 * src/tests/integration/txVerification.test.js
 *
 * Tests for services/txVerification.service.js
 *
 * Validates:
 *  - Successful InvestmentReceived event decode
 *  - Reverted tx (status = 0) → failure
 *  - Missing receipt (tx not mined) → failure
 *  - Wrong contract address → failure
 *  - campaignKey mismatch → failure
 *  - investor address mismatch → failure
 *  - No matching event log → failure
 *  - chain derivation via deriveChain()
 */

'use strict';

// ── Env patches (must be first) ───────────────────────────────────────────────
process.env.NODE_ENV                 = 'test';
process.env.JWT_SECRET               = 'test-secret';
process.env.DEV_STUB_BLOCKCHAIN_MODE = 'false';
process.env.ALCHEMY_RPC_URL          = 'https://polygon-amoy.mock.local';
// CONTRACT_ADDRESS must match MOCK_CONTRACT_ADDR = '0xdddd...dddd'
process.env.CONTRACT_ADDRESS         = '0x' + 'd'.repeat(40);
process.env.ADMIN_WALLET_PRIVATE_KEY = '0x' + '1'.repeat(64);

// ─────────────────────────────────────────────────────────────────────────────

const {
  MOCK_TX_HASH,
  MOCK_CAMPAIGN_KEY,
  MOCK_INVESTOR_ADDR,
  MOCK_AMOUNT_WEI,
  MOCK_AMOUNT_POL,
  MOCK_BLOCK_NUMBER,
  buildMockReceipt,
  buildMockInvestmentLog,
  blockchainModuleMock,
} = require('../helpers/mockBlockchain');

// ─── Shared jest.fn() instances used by both the mock factory AND the tests ────
// They must be declared before jest.mock() calls.
const mockGetReceipt = jest.fn();
const mockParseLog   = jest.fn();

// ─── ethers mock ─────────────────────────────────────────────────────────────
jest.mock('ethers', () => {
  const actual = jest.requireActual('ethers');
  return {
    ...actual,
    JsonRpcProvider: jest.fn().mockImplementation(() => ({
      getTransactionReceipt: jest.fn(),
    })),
  };
});

// ─── blockchain config mock ───────────────────────────────────────────────────
jest.mock('../../config/blockchain', () => ({
  ...require('../helpers/mockBlockchain').blockchainModuleMock,
  isBlockchainConfigured: jest.fn().mockReturnValue(true),
  getProvider: jest.fn(),
  getReadContract: jest.fn(),
}));

// ─── DB helper ────────────────────────────────────────────────────────────────
const { connectDB, disconnectDB, clearDB } = require('../helpers/dbHelper');

// ─── Service (imported after all mocks) ───────────────────────────────────────
let verifyInvestmentTx, deriveChain;

beforeAll(async () => {
  await connectDB();
  // Set up what getProvider and getReadContract return BEFORE loading service
  const blockchain = require('../../config/blockchain');
  blockchain.getProvider.mockReturnValue({ getTransactionReceipt: mockGetReceipt });
  blockchain.getReadContract.mockReturnValue({ interface: { parseLog: mockParseLog } });

  ({ verifyInvestmentTx, deriveChain } = require('../../services/txVerification.service'));
});

afterAll(() => disconnectDB());

afterEach(async () => {
  await clearDB();
  mockGetReceipt.mockReset();
  mockParseLog.mockReset();
  // Re-wire after reset so subsequent tests still get the spy
  const blockchain = require('../../config/blockchain');
  blockchain.getProvider.mockReturnValue({ getTransactionReceipt: mockGetReceipt });
  blockchain.getReadContract.mockReturnValue({ interface: { parseLog: mockParseLog } });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('txVerification.service — verifyInvestmentTx()', () => {

  describe('Successful verification', () => {
    it('returns success with parsed amount when receipt is valid and event matches', async () => {
      const receipt = buildMockReceipt({ status: 1, logs: [{ raw: true }] });
      mockGetReceipt.mockResolvedValue(receipt);
      mockParseLog.mockReturnValue(buildMockInvestmentLog({
        args: {
          campaignKey: MOCK_CAMPAIGN_KEY,
          investor:    MOCK_INVESTOR_ADDR,
          amount:      BigInt(MOCK_AMOUNT_WEI),
        },
      }));

      const result = await verifyInvestmentTx({
        txHash:               MOCK_TX_HASH,
        expectedCampaignKey:  MOCK_CAMPAIGN_KEY,
        expectedInvestorAddr: MOCK_INVESTOR_ADDR,
      });

      expect(result.success).toBe(true);
      expect(result.amountWei).toBe(MOCK_AMOUNT_WEI);
      expect(result.amountPOL).toBeCloseTo(MOCK_AMOUNT_POL, 4);
      expect(result.blockNumber).toBe(MOCK_BLOCK_NUMBER);
    });
  });

  describe('Failure cases', () => {

    it('fails when receipt is null (tx not yet mined)', async () => {
      mockGetReceipt.mockResolvedValue(null);

      const result = await verifyInvestmentTx({
        txHash: MOCK_TX_HASH,
        expectedCampaignKey: MOCK_CAMPAIGN_KEY,
        expectedInvestorAddr: MOCK_INVESTOR_ADDR,
      });

      expect(result.success).toBe(false);
      // Actual: 'Transaction not found. It may still be pending — wait for confirmation and retry.'
      expect(result.error).toMatch(/not found|pending/i);
    });

    it('fails when tx reverted (status = 0)', async () => {
      mockGetReceipt.mockResolvedValue(buildMockReceipt({ status: 0 }));

      const result = await verifyInvestmentTx({
        txHash: MOCK_TX_HASH,
        expectedCampaignKey: MOCK_CAMPAIGN_KEY,
        expectedInvestorAddr: MOCK_INVESTOR_ADDR,
      });

      expect(result.success).toBe(false);
      // Actual: 'Transaction was reverted (status = 0). The call failed on-chain.'
      expect(result.error).toMatch(/reverted|failed on-chain/i);
    });

    it('fails when receipt.to does not match contract address', async () => {
      const receipt = buildMockReceipt({ status: 1, to: '0x' + 'f'.repeat(40) });
      mockGetReceipt.mockResolvedValue(receipt);

      const result = await verifyInvestmentTx({
        txHash: MOCK_TX_HASH,
        expectedCampaignKey: MOCK_CAMPAIGN_KEY,
        expectedInvestorAddr: MOCK_INVESTOR_ADDR,
      });

      expect(result.success).toBe(false);
      // Actual: 'Transaction targeted 0xfff..., expected contract 0xddd...'
      expect(result.error).toMatch(/targeted|expected contract/i);
    });

    it('fails when campaignKey in event does not match expected', async () => {
      const receipt = buildMockReceipt({ status: 1, logs: [{ raw: true }] });
      mockGetReceipt.mockResolvedValue(receipt);

      const wrongKey = '0x' + 'e'.repeat(64);
      mockParseLog.mockReturnValue(buildMockInvestmentLog({
        args: {
          campaignKey: wrongKey,
          investor:    MOCK_INVESTOR_ADDR,
          amount:      BigInt(MOCK_AMOUNT_WEI),
        },
      }));

      const result = await verifyInvestmentTx({
        txHash: MOCK_TX_HASH,
        expectedCampaignKey:  MOCK_CAMPAIGN_KEY,
        expectedInvestorAddr: MOCK_INVESTOR_ADDR,
      });

      expect(result.success).toBe(false);
      // Actual: 'Transaction is for campaign key 0xeee..., not the expected 0xbbb...'
      expect(result.error).toMatch(/campaign key|not the expected/i);
    });

    it('fails when investor address in event does not match expected', async () => {
      const receipt = buildMockReceipt({ status: 1, logs: [{ raw: true }] });
      mockGetReceipt.mockResolvedValue(receipt);

      const wrongInvestor = '0x' + 'a'.repeat(40);
      mockParseLog.mockReturnValue(buildMockInvestmentLog({
        args: {
          campaignKey: MOCK_CAMPAIGN_KEY,
          investor:    wrongInvestor,
          amount:      BigInt(MOCK_AMOUNT_WEI),
        },
      }));

      const result = await verifyInvestmentTx({
        txHash: MOCK_TX_HASH,
        expectedCampaignKey:  MOCK_CAMPAIGN_KEY,
        expectedInvestorAddr: MOCK_INVESTOR_ADDR,
      });

      expect(result.success).toBe(false);
      // Actual: 'Transaction's investor... does not match expected investor...'
      expect(result.error).toMatch(/investor/i);
    });

    it('fails when no InvestmentReceived log found in receipt', async () => {
      const receipt = buildMockReceipt({ status: 1, logs: [{ raw: true }] });
      mockGetReceipt.mockResolvedValue(receipt);
      mockParseLog.mockReturnValue(null); // parseLog returns null → no matching event

      const result = await verifyInvestmentTx({
        txHash: MOCK_TX_HASH,
        expectedCampaignKey:  MOCK_CAMPAIGN_KEY,
        expectedInvestorAddr: MOCK_INVESTOR_ADDR,
      });

      expect(result.success).toBe(false);
      // Actual: 'InvestmentReceived event not found in transaction logs...'
      expect(result.error).toMatch(/InvestmentReceived|event not found/i);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('txVerification.service — deriveChain()', () => {

  let env, blockchain;

  beforeAll(() => {
    env        = require('../../config/env');
    blockchain = require('../../config/blockchain');
  });

  afterEach(() => {
    // Restore baseline
    env.ALCHEMY_RPC_URL = 'https://polygon-amoy.mock.local';
    blockchain.isBlockchainConfigured.mockReturnValue(true);
  });

  it('returns "polygon-amoy" for Amoy RPC URLs', () => {
    env.ALCHEMY_RPC_URL = 'https://polygon-amoy.g.alchemy.com/v2/abc';
    blockchain.isBlockchainConfigured.mockReturnValue(true);
    expect(deriveChain()).toBe('polygon-amoy');
  });

  it('returns "hardhat" for localhost RPC URLs', () => {
    env.ALCHEMY_RPC_URL = 'http://127.0.0.1:8545';
    blockchain.isBlockchainConfigured.mockReturnValue(true);
    expect(deriveChain()).toBe('hardhat');
  });

  it('returns "stub" when blockchain is not configured', () => {
    blockchain.isBlockchainConfigured.mockReturnValue(false);
    expect(deriveChain()).toBe('stub');
  });
});
