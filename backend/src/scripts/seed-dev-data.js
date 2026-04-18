/**
 * backend/src/scripts/seed-dev-data.js
 *
 * UPDATED FOR LOCAL QA PREP
 *
 * Developer seed script — creates realistic local QA data.
 * Safe to re-run: idempotent checks prevent duplicate records.
 *
 * Creates:
 *   - Admin user          (admin@test.com   / Pass1234)
 *   - Startup user        (startup@test.com / Pass1234)
 *   - Investor user       (investor@test.com / Pass1234)
 *   - StartupProfile      (Acme Robotics)
 *   - Campaign            (Acme Series A — active, 2 milestones)
 *   - Milestone #1        (index 0 — disbursed)
 *   - Milestone #2        (index 1 — pending, awaiting submission)
 *   - Investment          (investor → Acme Series A, INR 1000, confirmed)
 *
 * RUN:
 *   node src/scripts/seed-dev-data.js
 *   (from backend/ directory)
 *
 * ENV: requires MONGO_URI in backend/.env/.env (same as server)
 */

'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env/.env') });

const mongoose = require('mongoose');
const crypto = require('crypto');

// Import models (after dotenv so env is loaded)
const User = require('../models/User');
const StartupProfile = require('../models/StartupProfile');
const Campaign = require('../models/Campaign');
const Milestone = require('../models/Milestone');
const Investment = require('../models/Investment');

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('❌ [SEED] MONGO_URI not set. Ensure backend/.env/.env exists with MONGO_URI.');
  process.exit(1);
}

/** Generate a valid bytes32 hex string for campaignKey */
const randomBytes32Hex = () => '0x' + crypto.randomBytes(32).toString('hex');

// ─── Main Seed ───────────────────────────────────────────────────────────────

async function seedDevData() {
  console.log('\n══════════════════════════════════════════════');
  console.log('  Enigma Invest — DEV SEED SCRIPT');
  console.log('══════════════════════════════════════════════\n');

  try {
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 8000 });
    console.log('✅ [SEED] Connected to MongoDB\n');

    // Drop stale unique index that causes issues with multiple nulls in older schema version
    try {
      await User.collection.dropIndex('walletAddress_1');
      console.log('✅ [SEED] Dropped stale walletAddress_1 index');
    } catch (e) {
      // index might not exist or already be dropped, ignore
    }

    // ── 1. Admin User ─────────────────────────────────────────────────────────
    let admin = await User.findOne({ email: 'admin@test.com' });
    if (!admin) {
      admin = await User.create({
        fullName: 'Admin QA',
        email: 'admin@test.com',
        passwordHash: 'Pass1234',   // hashed by pre-save hook
        role: 'admin',
        isEmailVerified: true,
      });
      console.log('✅ Admin user created        → admin@test.com / Pass1234');
    } else {
      console.log('⚡ Admin user already exists → admin@test.com (updating password to Pass1234)');
      // Always reset password during seed to ensure dev access
      admin.passwordHash = 'Pass1234';
      await admin.save();
    }

    // ── 2. Startup User ───────────────────────────────────────────────────────
    let startupUser = await User.findOne({ email: 'startup@test.com' });
    if (!startupUser) {
      startupUser = await User.create({
        fullName: 'Startup Dev',
        email: 'startup@test.com',
        passwordHash: 'Pass1234',
        role: 'startup',
        isEmailVerified: true,
      });
      console.log('✅ Startup user created      → startup@test.com / Pass1234');
    } else {
      console.log('⚡ Startup user already exists → startup@test.com (updating password to Pass1234)');
      startupUser.passwordHash = 'Pass1234';
      await startupUser.save();
    }

    // ── 3. Investor User ──────────────────────────────────────────────────────
    let investorUser = await User.findOne({ email: 'investor@test.com' });
    if (!investorUser) {
      investorUser = await User.create({
        fullName: 'Investor Whale',
        email: 'investor@test.com',
        passwordHash: 'Pass1234',
        role: 'investor',
        isEmailVerified: true,
      });
      console.log('✅ Investor user created     → investor@test.com / Pass1234');
    } else {
      console.log('⚡ Investor user already exists → investor@test.com (updating password to Pass1234)');
      investorUser.passwordHash = 'Pass1234';
      await investorUser.save();
    }

    // ── 4. Startup Profile ────────────────────────────────────────────────────
    let profile = await StartupProfile.findOne({ userId: startupUser._id });
    if (!profile) {
      profile = await StartupProfile.create({
        userId: startupUser._id,
        startupName: 'Acme Robotics',
        tagline: 'Automating the future of domestic chores',
        description: [
          'Acme Robotics is building an affordable, multi-surface cleaning drone for',
          'residential and commercial use. Our AI-powered navigation system reduces',
          'cleaning time by 60% and operates autonomously without human intervention.',
          'We are targeting a $12B global cleaning robotics market with our proprietary',
          'obstacle-avoidance technology and competitive sub-$500 retail price point.',
        ].join(' '),
        industry: 'other',  // hardware robotics — closest available enum
        fundingStage: 'series_a',
        website: 'https://acmerobotics.test',
        location: { city: 'Bengaluru', country: 'India' },
        foundedYear: 2022,
        teamSize: 8,
        isVerified: true,
        verifiedAt: new Date(),
        teamMembers: [
          {
            name: 'Startup Dev',
            role: 'CEO & Co-Founder',
            bio: 'Former SWE at Google. 10 years in robotics R&D.',
            linkedIn: 'https://linkedin.com/in/startupdev',
          },
          {
            name: 'Priya Mehta',
            role: 'CTO',
            bio: 'PhD in Autonomous Systems, IISc Bangalore.',
          },
        ],
      });
      console.log('✅ Startup profile created   → Acme Robotics (verified)');
    } else {
      console.log('⚡ Startup profile already exists → Acme Robotics');
    }

    // ── 5. Campaign ───────────────────────────────────────────────────────────
    let campaign = await Campaign.findOne({ title: 'Acme Series A' });
    if (!campaign) {
      campaign = await Campaign.create({
        startupProfileId: profile._id,
        userId: startupUser._id,  // REQUIRED — denormalized owner ref
        title: 'Acme Series A',
        summary: [
          'Acme Robotics is raising ₹50,000 to scale manufacturing of its V2 cleaning',
          'drone. Funds will cover tooling procurement (40%) and a pan-India marketing',
          'launch (60%). Min investment ₹500, max ₹10,000 per investor.',
        ].join(' '),
        fundingGoal: 50000,
        currency: 'INR',  // on-chain denomination (payments made via Razorpay in INR)
        minInvestment: 500,
        maxInvestment: 10000,
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        status: 'active',
        milestoneCount: 2,
        milestonePercentages: [40, 60],  // must sum to 100
        currentMilestoneIndex: 1,        // milestone 0 disbursed; milestone 1 is next
        currentRaised: 1000,       // from seeded investment below
        investorCount: 1,
        campaignKey: randomBytes32Hex(),  // valid 0x-prefixed bytes32
        isContractDeployed: false,       // not on-chain yet — purely off-chain QA
        tags: ['robotics', 'hardware', 'AI', 'cleantech'],
      });
      console.log('✅ Campaign created          → Acme Series A (active, 2 milestones)');
    } else {
      console.log('⚡ Campaign already exists   → Acme Series A');
    }

    // ── 6. Milestones ─────────────────────────────────────────────────────────
    const existingMilestoneCount = await Milestone.countDocuments({ campaignId: campaign._id });
    if (existingMilestoneCount === 0) {
      await Milestone.insertMany([
        {
          campaignId: campaign._id,
          startupProfileId: profile._id,
          userId: startupUser._id,
          index: 0,
          title: 'Procure Manufacturing Tooling',
          description: [
            'Acquire the required injection molds, CNC tooling, and plastic compounds',
            'from our approved vendor in Pune. This milestone covers all tooling costs',
            'needed to begin mass production of 500 units for pilot batch delivery.',
          ].join(' '),
          targetDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
          percentage: 40,
          estimatedAmount: 20000,
          status: 'disbursed',
          proofSubmission: {
            description: [
              'Tooling procured from Precision Tools Pvt Ltd, Pune. Invoice #PT-20240312.',
              'All 14 molds delivered and verified by our CTO on March 28, 2024.',
              'Production line is now operational and running at 80% capacity.',
            ].join(' '),
            proofLinks: ['https://github.com/acmerobotics/milestone-1-evidence'],
            documents: [],
            submittedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
          },
          approvedBy: admin._id,
          approvedAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
          disbursedAmount: 20000,
          disbursedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
          disbursedBy: admin._id,
          disbursalReference: 'IMPS-DEV-SEED-001',
          disbursalNote: 'Dev seed: milestone 0 pre-marked disbursed for QA.',
        },
        {
          campaignId: campaign._id,
          startupProfileId: profile._id,
          userId: startupUser._id,
          index: 1,
          title: 'Marketing Launch',
          description: [
            'Initiate a major pan-India digital marketing campaign targeting B2C consumers',
            'via Google Ads, Instagram Reels, and influencer partnerships. Goal: 50,000',
            'impressions and 500 demo sign-ups within first 30 days of launch spend.',
          ].join(' '),
          targetDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days out
          percentage: 60,
          estimatedAmount: 30000,
          status: 'pending',  // startup has NOT yet submitted proof
        },
      ]);
      console.log('✅ Milestones created        → #0 disbursed, #1 pending');
    } else {
      console.log('⚡ Milestones already exist  → skipping');
    }

    // ── 7. Seeded Investment ──────────────────────────────────────────────────
    const existingInvestment = await Investment.findOne({
      paymentOrderId: 'dev_seed_order_001',
    });
    if (!existingInvestment) {
      await Investment.create({
        campaignId: campaign._id,
        startupProfileId: profile._id,
        investorUserId: investorUser._id,
        amount: 1000,
        currency: 'INR',
        chain: 'stub',     // REQUIRED field — no blockchain in QA
        status: 'confirmed',
        confirmedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        verificationNote: 'Dev seed: simulated Razorpay payment (DEV_BYPASS_PAYMENT)',
        paymentOrderId: 'dev_seed_order_001',
        paymentId: 'dev_seed_pay_001',
        paymentProvider: 'razorpay',
        blockchainStatus: 'skipped',
      });
      console.log('✅ Investment created        → investor@test.com → ₹1,000 → Acme Series A');
    } else {
      console.log('⚡ Seeded investment already exists → skipping');
    }

    // ── Summary ───────────────────────────────────────────────────────────────
    console.log('\n══════════════════════════════════════════════');
    console.log('  SEED COMPLETE — Test Accounts');
    console.log('══════════════════════════════════════════════');
    console.log('  Role     │ Email                │ Password');
    console.log('  ─────────┼──────────────────────┼──────────');
    console.log('  admin    │ admin@test.com        │ Pass1234');
    console.log('  startup  │ startup@test.com      │ Pass1234');
    console.log('  investor │ investor@test.com     │ Pass1234');
    console.log('══════════════════════════════════════════════\n');

  } catch (err) {
    console.error('\n❌ [SEED] Failed:', err.message);
    if (err.errors) {
      Object.values(err.errors).forEach((e) => console.error('  Validation:', e.message));
    }
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('[SEED] MongoDB connection closed.');
    process.exit(process.exitCode || 0);
  }
}

seedDevData();
