/**
 * src/tests/integration/milestoneEvidence.controller.test.js
 *
 * Coverage:
 *  - Release evidence bundle: success path, wrong status 400, 404, concurrency
 *  - Approve evidence bundle: success path, wrong status 400
 *
 * Actual route (from Express route listing):
 *   POST /api/v1/campaigns/:campaignId/milestones/:milestoneIndex/evidence/release
 *   POST /api/v1/campaigns/:campaignId/milestones/:milestoneIndex/evidence/approve
 */

'use strict';

process.env.NODE_ENV                    = 'test';
process.env.JWT_SECRET                  = 'test-secret';
process.env.DEV_STUB_BLOCKCHAIN_MODE    = 'false';
process.env.ALCHEMY_RPC_URL             = 'https://polygon-amoy.mock.local';
process.env.CONTRACT_ADDRESS            = '0x' + 'd'.repeat(40);
process.env.ADMIN_WALLET_PRIVATE_KEY    = '0x' + '1'.repeat(64);
process.env.OPERATOR_WALLET_PRIVATE_KEY = '0x' + '2'.repeat(64);
process.env.REVIEWER_WALLET_PRIVATE_KEY = '0x' + '3'.repeat(64);

jest.mock('../../config/blockchain', () => ({
  ...require('../helpers/mockBlockchain').blockchainModuleMock,
  requireBlockchainOrStub: jest.fn().mockReturnValue({ configured: true, stubMode: false }),
}));

jest.mock('../../services/blockchain.service', () => ({
  releaseMilestoneOnChain: jest.fn().mockResolvedValue({
    txHash:      '0x' + 'a'.repeat(64),
    blockNumber: 12345678,
    releasedAt:  new Date(),
  }),
  approveMilestoneOnChain: jest.fn().mockResolvedValue({
    txHash:      '0x' + 'a'.repeat(64),
    blockNumber: 12345678,
  }),
  anchorEvidenceOnChain: jest.fn().mockResolvedValue({
    txHash:      '0x' + 'a'.repeat(64),
    blockNumber: 12345678,
  }),
}));

const supertest = require('supertest');
const jwt       = require('jsonwebtoken');
const mongoose  = require('mongoose');

const { connectDB, disconnectDB, clearDB } = require('../helpers/dbHelper');
const { seedActivatedCampaign, createUser } = require('../helpers/seedHelpers');

let app, User, Campaign, EvidenceBundle, StartupProfile;

beforeAll(async () => {
  await connectDB();
  app            = require('../../app');
  User           = require('../../models/User');
  Campaign       = require('../../models/Campaign');
  EvidenceBundle = require('../../models/EvidenceBundle');
  StartupProfile = require('../../models/StartupProfile');
});

afterAll(() => disconnectDB());
afterEach(async () => {
  await clearDB();
  jest.clearAllMocks();
});

const signToken = (user) =>
  jwt.sign({ userId: user._id.toString(), role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });

const models = () => ({ User, Campaign, StartupProfile });

// Helper: seed an EvidenceBundle with given onChainStatus
const seedBundle = async (onChainStatus = 'approved') => {
  const { startupUser, campaign } = await seedActivatedCampaign(models());
  const adminUser = await createUser(User, { role: 'admin' });

  const bundle = await EvidenceBundle.create({
    campaignId:     campaign._id,
    uploadedBy:     startupUser._id,
    campaignKey:    campaign.campaignKey,
    milestoneIndex: 0,
    evidenceHash:   '0x' + 'e'.repeat(64),
    summaryHash:    '0x' + 'f'.repeat(64),
    onChainStatus,
    title:          'Milestone proof',
    evidenceFiles:  [],
  });

  // Route: /api/v1/campaigns/:campaignId/milestones/:milestoneIndex/evidence/release|approve
  const releaseUrl = `/api/v1/campaigns/${campaign._id}/milestones/0/evidence/release`;
  const approveUrl = `/api/v1/campaigns/${campaign._id}/milestones/0/evidence/approve`;

  return { adminUser, startupUser, campaign, bundle, releaseUrl, approveUrl };
};

// ─────────────────────────────────────────────────────────────────────────────

describe('POST .../evidence/release — releaseMilestoneFunds', () => {

  it('200: releases milestone funds and sets onChainStatus to released', async () => {
    const { adminUser, bundle, releaseUrl } = await seedBundle('approved');
    const token = signToken(adminUser);

    const res = await supertest(app)
      .post(releaseUrl)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    const updated = await EvidenceBundle.findById(bundle._id);
    expect(updated.onChainStatus).toBe('released');
    expect(updated.releaseTxHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
  });

  it('409: rejects release when bundle is not in "approved" status (atomic CAS guard)', async () => {
    const { adminUser, releaseUrl } = await seedBundle('anchored');
    const token = signToken(adminUser);

    const res = await supertest(app)
      .post(releaseUrl)
      .set('Authorization', `Bearer ${token}`);

    // Controller uses findOneAndUpdate({ onChainStatus: 'approved' }), returns 409 Conflict
    // when the bundle is not in 'approved' state (e.g. 'anchored', 'releasing', 'released').
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/approved|status|in progress/i);
  });

  it('404: returns 404 for non-existent campaign or milestone', async () => {
    const adminUser = await createUser(User, { role: 'admin' });
    const token = signToken(adminUser);
    const fakeId = new mongoose.Types.ObjectId();

    const res = await supertest(app)
      .post(`/api/v1/campaigns/${fakeId}/milestones/0/evidence/release`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('Concurrency: only first of two simultaneous release calls succeeds', async () => {
    const { adminUser, bundle, releaseUrl } = await seedBundle('approved');
    const token = signToken(adminUser);

    const [res1, res2] = await Promise.all([
      supertest(app).post(releaseUrl).set('Authorization', `Bearer ${token}`),
      supertest(app).post(releaseUrl).set('Authorization', `Bearer ${token}`),
    ]);

    const statuses = [res1.status, res2.status].sort();
    expect(statuses[0]).toBe(200);
    expect([400, 409, 423]).toContain(statuses[1]);

    const updated = await EvidenceBundle.findById(bundle._id);
    expect(updated.onChainStatus).toBe('released');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('POST .../evidence/approve — approveMilestoneEvidence', () => {

  it('200: approves an anchored bundle', async () => {
    const { adminUser, bundle, approveUrl } = await seedBundle('anchored');
    const token = signToken(adminUser);

    const res = await supertest(app)
      .post(approveUrl)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    const updated = await EvidenceBundle.findById(bundle._id);
    expect(updated.onChainStatus).toBe('approved');
    expect(updated.approveTxHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
  });

  it('400: rejects approval when bundle is not anchored', async () => {
    const { adminUser, approveUrl } = await seedBundle('processed');
    const token = signToken(adminUser);

    const res = await supertest(app)
      .post(approveUrl)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/anchored|status/i);
  });
});
