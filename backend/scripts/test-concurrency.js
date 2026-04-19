/**
 * backend/scripts/test-concurrency.js
 *
 * Simulates concurrent milestone fund release requests to verify the atomic lock.
 */

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// 1. Setup Mocking BEFORE requiring the controller
const blockchain = require('../src/config/blockchain');
const blockchainService = require('../src/services/blockchain.service');

blockchain.isBlockchainConfigured = () => true;

blockchainService.releaseMilestoneOnChain = async () => {
  console.log('🔗 [Mock] releaseMilestoneOnChain started (2s delay)...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  console.log('🔗 [Mock] releaseMilestoneOnChain finished.');
  return {
    txHash: '0x' + 'a'.repeat(64),
    blockNumber: 12345,
    amountWei: '1000000000000000000'
  };
};

// 2. NOW require the controller (it will destructure the already-mocked functions)
const milestoneController = require('../src/controllers/milestoneEvidence.controller');
const Campaign = require('../src/models/Campaign');
const EvidenceBundle = require('../src/models/EvidenceBundle');

async function runTest() {
  console.log('🚀 Starting Concurrency Test...');
  
  // Setup in-memory MongoDB
  const mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  console.log('✅ In-memory MongoDB connected');

  // Create mock Campaign
  const campaignId = new mongoose.Types.ObjectId();
  const campaign = await Campaign.create({
    _id: campaignId,
    startupProfileId: new mongoose.Types.ObjectId(),
    userId: new mongoose.Types.ObjectId(),
    title: 'Concurrency Test Campaign',
    summary: 'Testing the findOneAndUpdate atomic lock mechanism.',
    sector: 'Testing',
    category: 'Security',
    fundingStage: 'seed',
    riskScore: 3,
    returnPotential: 'low',
    fundingGoal: 1000,
    deadline: new Date(Date.now() + 86400000),
    milestoneCount: 1,
    milestonePercentages: [100],
    currentMilestoneIndex: 0,
    campaignKey: '0x' + 'f'.repeat(64)
  });
  console.log('✅ Mock Campaign created:', campaignId);

  // Create mock Evidence Bundle in 'approved' state
  const bundle = await EvidenceBundle.create({
    campaignId: campaignId,
    milestoneIndex: 0,
    startupProfileId: campaign.startupProfileId,
    campaignKey: campaign.campaignKey,
    title: 'Q1 Milestone Evidence',
    status: 'approved',
    onChainStatus: 'approved',
    uploadedBy: campaign.userId,
    evidenceHash: '0x' + '2'.repeat(64),
    summaryHash: '0x' + '3'.repeat(64)
  });
  console.log('✅ Mock EvidenceBundle created:', bundle._id);

  // Mock Express Request/Response
  const createMockRes = (name) => ({
    statusCode: 0,
    body: null,
    status: function(code) { this.statusCode = code; return this; },
    json: function(data) { 
      this.body = data; 
      console.log(`[${name}] Response: ${this.statusCode} | Msg: ${data.message}`);
      return this; 
    }
  });

  const req = {
    params: { 
      campaignId: campaignId.toString(),
      milestoneIndex: '0'
    }
  };

  const res1 = createMockRes('Request A');
  const res2 = createMockRes('Request B');

  // Execute two simultaneous calls
  console.log('⚔️  Firing simultaneous release calls...');
  
  const p1 = milestoneController.releaseMilestoneFunds(req, res1);
  // Wait bit more than 100ms to ensure Request A hits the lock first but is still in delay
  await new Promise(resolve => setTimeout(resolve, 300)); 
  const p2 = milestoneController.releaseMilestoneFunds(req, res2);

  await Promise.all([p1, p2]);

  // Verify Results
  console.log('\n--- Test Evaluation ---');
  const finalBundle = await EvidenceBundle.findById(bundle._id);
  console.log('Final Bundle State:', finalBundle.onChainStatus);

  const codes = [res1.statusCode, res2.statusCode];
  if (codes.includes(200) && codes.includes(409)) {
    console.log('🏆 SUCCESS: Atomic lock prevented double-release!');
  } else {
    console.log('❌ FAILURE: Concurrency guard failed. Status codes:', codes);
  }

  // Cleanup
  await mongoose.disconnect();
  await mongoServer.stop();
  console.log('🏁 Test finished.');
}

runTest().catch(err => {
  console.error('💥 Test Crashed:', err);
  process.exit(1);
});
