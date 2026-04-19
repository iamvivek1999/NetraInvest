/**
 * src/scripts/dev-e2e-seed.js
 *
 * Web3-native End-to-End Development Seed Script
 *
 * Designed for: local Hardhat node + backend development workflow.
 *
 * Creates:
 *   - Admin user
 *   - Startup user + StartupProfile (fully verified)
 *   - Investor user
 *   - Campaign (on-chain ready, with campaignKey from env/random)
 *   - 2 Milestones (milestone 0: next-to-release, milestone 1: pending)
 *   - 1 Web3 Investment (POL, status: confirmed, from env or random txHash)
 *   - 1 EvidenceBundle (milestoneIndex 0, status: anchored — ready for approval)
 *
 * ENV vars checked (all optional for local dev):
 *   CONTRACT_ADDRESS   — if set, marks campaign as isContractDeployed=true
 *   WEB3_SEED_CAMPAIGN_KEY  — if set, uses this as the campaignKey (bytes32 hex)
 *   WEB3_SEED_TX_HASH       — if set, uses this as the seed investment txHash
 *   WEB3_SEED_INVESTOR_WALLET — if set, uses this as the investor wallet address
 *
 * RUN:
 *   node src/scripts/dev-e2e-seed.js     (from backend/ directory)
 *   npm run seed:web3
 */

'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env/.env') });
require('dotenv').config();

const mongoose = require('mongoose');
const crypto = require('crypto');

// ─── Env ──────────────────────────────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('❌ [WEB3-SEED] MONGO_URI not set.');
  process.exit(1);
}

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || null;
const CAMPAIGN_KEY     = process.env.WEB3_SEED_CAMPAIGN_KEY || ('0x' + crypto.randomBytes(32).toString('hex'));
const SEED_TX_HASH     = process.env.WEB3_SEED_TX_HASH       || ('0x' + crypto.randomBytes(32).toString('hex'));
const INVESTOR_WALLET  = process.env.WEB3_SEED_INVESTOR_WALLET || ('0x' + 'face'.repeat(10));

// ─── Models ───────────────────────────────────────────────────────────────────
const User            = require('../models/User');
const StartupProfile  = require('../models/StartupProfile');
const Campaign        = require('../models/Campaign');
const Milestone       = require('../models/Milestone');
const Investment      = require('../models/Investment');
const EvidenceBundle  = require('../models/EvidenceBundle');

// ─── Seed ───────────────────────────────────────────────────────────────────

async function seedWeb3Data() {
  console.log('\n══════════════════════════════════════════════════════════');
  console.log('  Enigma — Web3 E2E Development Seed (Phase 12)');
  console.log('══════════════════════════════════════════════════════════\n');

  await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 10_000 });
  console.log('✅ Connected to MongoDB\n');

  // ── Drop stale indexes ───────────────────────────────────────────────────
  try {
    await User.collection.dropIndex('walletAddress_1');
  } catch (_) { /* index may not exist */ }

  // ── 1. Admin ─────────────────────────────────────────────────────────────
  let admin = await User.findOne({ email: 'admin@enigma.dev' });
  if (!admin) {
    admin = await User.create({
      fullName: 'Enigma Admin',
      email: 'admin@enigma.dev',
      passwordHash: 'Admin@1234',
      role: 'admin',
      isEmailVerified: true,
    });
    console.log('✅ Admin created          → admin@enigma.dev / Admin@1234');
  } else {
    admin.passwordHash = 'Admin@1234';
    await admin.save();
    console.log('⚡ Admin exists           → password reset to Admin@1234');
  }

  // ── 2. Startup User ───────────────────────────────────────────────────────
  let startupUser = await User.findOne({ email: 'startup@enigma.dev' });
  if (!startupUser) {
    startupUser = await User.create({
      fullName: 'NovaTech Founder',
      email: 'startup@enigma.dev',
      passwordHash: 'Startup@1234',
      role: 'startup',
      isEmailVerified: true,
    });
    console.log('✅ Startup created        → startup@enigma.dev / Startup@1234');
  } else {
    startupUser.passwordHash = 'Startup@1234';
    await startupUser.save();
    console.log('⚡ Startup exists         → password reset');
  }

  // ── 3. Investor User ──────────────────────────────────────────────────────
  let investorUser = await User.findOne({ email: 'investor@enigma.dev' });
  if (!investorUser) {
    investorUser = await User.create({
      fullName: 'Web3 Whale',
      email: 'investor@enigma.dev',
      passwordHash: 'Investor@1234',
      role: 'investor',
      isEmailVerified: true,
    });
    console.log('✅ Investor created       → investor@enigma.dev / Investor@1234');
  } else {
    investorUser.passwordHash = 'Investor@1234';
    await investorUser.save();
    console.log('⚡ Investor exists        → password reset');
  }

  // ── 4. Startup Profile ────────────────────────────────────────────────────
  let profile = await StartupProfile.findOne({ userId: startupUser._id });
  if (!profile) {
    profile = await StartupProfile.create({
      userId: startupUser._id,
      startupName: 'NovaTech AI',
      tagline: 'Decentralized Intelligence for a Decentralized World',
      description: [
        'NovaTech AI builds on-chain machine learning inference pipelines, allowing',
        'DApps to query AI models directly from smart contracts without centralized oracles.',
        'Our zkML proof system makes AI predictions verifiable and tamper-proof.',
      ].join(' '),
      industry: 'fintech',
      fundingStage: 'seed',
      website: 'https://novatech.ai',
      location: { city: 'Bangalore', country: 'India' },
      foundedYear: 2024,
      teamSize: 5,
      isVerified: true,
      verifiedAt: new Date(),
      teamMembers: [
        { name: 'NovaTech Founder', role: 'CEO', bio: 'Ex-Google, ML researcher' },
        { name: 'Riya Shah', role: 'CTO', bio: 'ZK-proof expert, IIT Bombay' },
      ],
    });
    console.log('✅ Profile created        → NovaTech AI (isVerified: true)');
  } else {
    console.log('⚡ Profile exists         → NovaTech AI');
  }

  // ── 5. Campaign ───────────────────────────────────────────────────────────
  let campaign = await Campaign.findOne({ campaignKey: CAMPAIGN_KEY });
  if (!campaign) {
    campaign = await Campaign.create({
      startupProfileId: profile._id,
      userId: startupUser._id,
      title: 'NovaTech Seed Round',
      summary: 'Raising 10 POL to fund zkML proof system development and early DApp integrations.',
      fundingGoal: 10,
      fundingGoalWei: '10000000000000000000',  // 10 POL in wei
      currency: 'POL',
      minInvestment: 0.01,
      maxInvestment: 5,
      deadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),  // 60 days
      onChainStatus: 'active',
      milestoneCount: 2,
      milestonePercentages: [40, 60, 0, 0, 0],
      currentMilestoneIndex: 0,
      currentRaised: 1.5,
      currentRaisedWei: '1500000000000000000',
      totalRaisedWei: '1500000000000000000',
      investorCount: 1,
      campaignKey: CAMPAIGN_KEY,
      isContractDeployed: !!CONTRACT_ADDRESS,
      contractAddress: CONTRACT_ADDRESS,
      tags: ['AI', 'zkML', 'DeFi', 'Web3'],
    });
    console.log(`✅ Campaign created       → NovaTech Seed Round`);
    console.log(`   campaignKey: ${CAMPAIGN_KEY}`);
  } else {
    console.log('⚡ Campaign exists        → NovaTech Seed Round');
  }

  // ── 6. Milestones ─────────────────────────────────────────────────────────
  const mCount = await Milestone.countDocuments({ campaignId: campaign._id });
  if (mCount === 0) {
    await Milestone.insertMany([
      {
        campaignId: campaign._id,
        startupProfileId: profile._id,
        userId: startupUser._id,
        index: 0,
        title: 'zkML Proof System Alpha',
        description: 'Release the open-source zkML proof SDK for smart contract developers.',
        targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        percentage: 40,
        estimatedAmount: 4,
        status: 'pending',
      },
      {
        campaignId: campaign._id,
        startupProfileId: profile._id,
        userId: startupUser._id,
        index: 1,
        title: 'First DApp Integration Partners',
        description: 'Onboard 3 DApps to use NovaTech zkML for on-chain prediction auctions.',
        targetDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        percentage: 60,
        estimatedAmount: 6,
        status: 'pending',
      },
    ]);
    console.log('✅ Milestones created     → #0 zkML Alpha, #1 DApp Partners');
  } else {
    console.log('⚡ Milestones exist       → skipping');
  }

  // ── 7. Web3 Investment ────────────────────────────────────────────────────
  const existingInv = await Investment.findOne({ txHash: SEED_TX_HASH });
  if (!existingInv) {
    await Investment.create({
      campaignId:      campaign._id,
      startupProfileId: profile._id,
      investorUserId:  investorUser._id,
      txHash:          SEED_TX_HASH,
      investorWallet:  INVESTOR_WALLET.toLowerCase(),
      campaignKey:     CAMPAIGN_KEY,
      contractAddress: CONTRACT_ADDRESS,
      amount:          1.5,
      amountWei:       '1500000000000000000',
      currency:        'POL',
      chain:           CONTRACT_ADDRESS ? 'hardhat' : 'stub',
      syncStatus:      'confirmed',
      sourceOfTruth:   'blockchain',
      confirmedAt:     new Date(),
      blockNumber:     12345678,
      verificationNote: 'Dev seed: Web3 investment (seeded for local testing)',
    });
    console.log(`✅ Investment created     → 1.5 POL → NovaTech Seed Round`);
    console.log(`   txHash: ${SEED_TX_HASH}`);
  } else {
    console.log('⚡ Investment exists      → skipping');
  }

  // ── 8. EvidenceBundle (milestone 0 — anchored, ready for approval) ────────
  const existingBundle = await EvidenceBundle.findOne({
    campaignKey: CAMPAIGN_KEY,
    milestoneIndex: 0,
  });
  if (!existingBundle) {
    await EvidenceBundle.create({
      campaignId:     campaign._id,
      milestoneId:    null,
      uploadedBy:     startupUser._id,
      campaignKey:    CAMPAIGN_KEY,
      milestoneIndex: 0,
      title:          'zkML Alpha — Technical Specification',
      description:    'Full zkML proof system architecture document with gas benchmarks.',
      evidenceFiles:  [],
      evidenceHash:   '0x' + crypto.createHash('sha256').update('zkml-evidence').digest('hex'),
      summaryHash:    '0x' + crypto.createHash('sha256').update('zkml-summary').digest('hex'),
      onChainStatus:  'anchored',  // ready for admin approval
      submitTxHash:   '0x' + crypto.randomBytes(32).toString('hex'),
      anchoredAt:     new Date(),
      storageBackend: 'local',
    });
    console.log('✅ EvidenceBundle created → milestone #0, status: anchored');
    console.log('   ℹ️  Admin can now approve via POST /api/v1/milestones/approve/:bundleId');
  } else {
    console.log('⚡ EvidenceBundle exists  → skipping');
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════════');
  console.log('  WEB3 SEED COMPLETE — Test Accounts');
  console.log('══════════════════════════════════════════════════════════');
  console.log('  Role     │ Email                    │ Password');
  console.log('  ─────────┼──────────────────────────┼──────────────');
  console.log('  admin    │ admin@enigma.dev          │ Admin@1234');
  console.log('  startup  │ startup@enigma.dev        │ Startup@1234');
  console.log('  investor │ investor@enigma.dev       │ Investor@1234');
  console.log('══════════════════════════════════════════════════════════');
  console.log('\n  Campaign Details:');
  console.log(`  Campaign ID    : ${campaign._id}`);
  console.log(`  Campaign Key   : ${CAMPAIGN_KEY}`);
  console.log(`  Contract       : ${CONTRACT_ADDRESS || '(not on-chain — set CONTRACT_ADDRESS)'}`);
  console.log(`  Seed txHash    : ${SEED_TX_HASH}`);
  console.log('\n  Next steps:');
  console.log('  1. POST /api/v1/auth/login → get JWT token');
  console.log('  2. GET /api/v1/campaigns → view campaigns');
  console.log('  3. POST /api/v1/investments → record investment (stub or on-chain)');
  console.log('  4. POST /api/v1/milestones/approve/:bundleId → approve anchored milestone');
  console.log('══════════════════════════════════════════════════════════\n');

  await mongoose.disconnect();
  process.exit(0);
}

seedWeb3Data().catch((err) => {
  console.error('\n❌ [WEB3-SEED] Failed:', err);
  process.exit(1);
});
