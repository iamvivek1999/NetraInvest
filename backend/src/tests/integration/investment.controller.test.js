/**
 * src/tests/integration/investment.controller.test.js
 *
 * Supertest integration tests for POST /api/v1/investments
 * and the investment read endpoints.
 */

'use strict';

process.env.NODE_ENV                 = 'test';
process.env.JWT_SECRET               = 'test-secret';
process.env.DEV_STUB_BLOCKCHAIN_MODE = 'true';
process.env.ALCHEMY_RPC_URL          = '';
process.env.CONTRACT_ADDRESS         = '';
process.env.ADMIN_WALLET_PRIVATE_KEY = '';

jest.mock('../../config/blockchain', () => ({
  ...require('../helpers/mockBlockchain').blockchainModuleMock,
  isBlockchainConfigured:  jest.fn().mockReturnValue(false),
  requireBlockchainOrStub: jest.fn().mockReturnValue({ configured: false, stubMode: true }),
}));

jest.mock('../../services/txVerification.service', () => ({
  verifyInvestmentTx: jest.fn().mockResolvedValue({ success: true }),
  deriveChain:        jest.fn().mockReturnValue('stub'),
}));

const supertest = require('supertest');
const mongoose  = require('mongoose');
const jwt       = require('jsonwebtoken');

const { connectDB, disconnectDB, clearDB } = require('../helpers/dbHelper');
const { seedCampaignWithInvestor, createUser } = require('../helpers/seedHelpers');

let app, User, Campaign, Investment, StartupProfile;

beforeAll(async () => {
  await connectDB();
  app            = require('../../app');
  User           = require('../../models/User');
  Campaign       = require('../../models/Campaign');
  Investment     = require('../../models/Investment');
  StartupProfile = require('../../models/StartupProfile');
});

afterAll(() => disconnectDB());
afterEach(async () => { await clearDB(); });

const signToken = (user) =>
  jwt.sign({ userId: user._id.toString(), role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });

const models = () => ({ User, Campaign, StartupProfile });

// ─────────────────────────────────────────────────────────────────────────────
// minInvestment defaults to 1 in the Campaign model, so all test amounts must be >= 1

describe('POST /api/v1/investments — Stub Mode', () => {

  it('201: records a stub investment with valid body', async () => {
    const { campaign, investorUser } = await seedCampaignWithInvestor(models());
    const token = signToken(investorUser);

    const res = await supertest(app)
      .post('/api/v1/investments')
      .set('Authorization', `Bearer ${token}`)
      .send({ campaignId: campaign._id.toString(), amount: 2, currency: 'POL' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.investment.syncStatus).toBe('stub');
    expect(res.body.data.verification.mode).toBe('stub');
  });

  it('422: returns validation error when campaignId is missing', async () => {
    const investorUser = await createUser(User, { role: 'investor' });
    const token = signToken(investorUser);

    const res = await supertest(app)
      .post('/api/v1/investments')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 2 });

    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/campaignId/i);
  });

  it('rejects amount=0 in stub mode (400 or 422)', async () => {
    const { campaign, investorUser } = await seedCampaignWithInvestor(models());
    const token = signToken(investorUser);

    const res = await supertest(app)
      .post('/api/v1/investments')
      .set('Authorization', `Bearer ${token}`)
      .send({ campaignId: campaign._id.toString(), amount: 0 });

    expect([400, 422]).toContain(res.status);
    expect(res.body.message).toMatch(/amount/i);
  });

  it('404: returns 404 for non-existent campaign', async () => {
    const investorUser = await createUser(User, { role: 'investor' });
    const token = signToken(investorUser);

    const res = await supertest(app)
      .post('/api/v1/investments')
      .set('Authorization', `Bearer ${token}`)
      .send({ campaignId: new mongoose.Types.ObjectId().toString(), amount: 2 });

    expect(res.status).toBe(404);
  });

  it('400: rejects investment in a non-active campaign', async () => {
    const { campaign, investorUser } = await seedCampaignWithInvestor(models(), { onChainStatus: 'paused' });
    const token = signToken(investorUser);

    const res = await supertest(app)
      .post('/api/v1/investments')
      .set('Authorization', `Bearer ${token}`)
      .send({ campaignId: campaign._id.toString(), amount: 2 });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not accepting|onChainStatus/i);
  });

  it('401: rejects unauthenticated request', async () => {
    const { campaign } = await seedCampaignWithInvestor(models());

    const res = await supertest(app)
      .post('/api/v1/investments')
      .send({ campaignId: campaign._id.toString(), amount: 2 });

    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/v1/investments — Idempotency', () => {

  it('200: returns existing record for duplicate txHash without creating duplicate', async () => {
    const { campaign, investorUser } = await seedCampaignWithInvestor(models());
    const token = signToken(investorUser);
    const txHash = '0x' + 'a'.repeat(64);

    // Pre-seed an investment with this txHash to simulate prior sync
    await Investment.create({
      campaignId:       campaign._id,
      startupProfileId: campaign.startupProfileId,
      investorUserId:   investorUser._id,
      txHash,
      amount:           2,
      chain:            'stub',
      syncStatus:       'confirmed',
    });

    const res = await supertest(app)
      .post('/api/v1/investments')
      .set('Authorization', `Bearer ${token}`)
      .send({ campaignId: campaign._id.toString(), txHash, walletAddress: '0x' + 'c'.repeat(40), amount: 2 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.verification.mode).toBe('idempotent');
    expect(await Investment.countDocuments({ txHash })).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/v1/investments/my', () => {

  it('200: returns investments with correct summary total', async () => {
    const { campaign, investorUser } = await seedCampaignWithInvestor(models());
    const token = signToken(investorUser);

    await Investment.create([
      {
        campaignId: campaign._id, startupProfileId: campaign.startupProfileId,
        investorUserId: investorUser._id, amount: 2, chain: 'stub', syncStatus: 'stub',
      },
      {
        campaignId: campaign._id, startupProfileId: campaign.startupProfileId,
        investorUserId: investorUser._id, amount: 3, chain: 'stub', syncStatus: 'stub',
      },
    ]);

    const res = await supertest(app)
      .get('/api/v1/investments/my')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.investments).toHaveLength(2);
    // totalAmount from MongoDB $sum aggregation
    expect(res.body.data.summary.totalAmount).toBeCloseTo(5, 4);
  });

  it('200: returns empty array for investor with no investments', async () => {
    const investorUser = await createUser(User, { role: 'investor' });
    const token = signToken(investorUser);

    const res = await supertest(app)
      .get('/api/v1/investments/my')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.investments).toHaveLength(0);
    expect(res.body.data.summary.totalAmount).toBe(0);
  });
});
