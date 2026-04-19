'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env/.env') });

const mongoose = require('mongoose');
const crypto = require('crypto');

const User = require('../models/User');
const StartupProfile = require('../models/StartupProfile');
const InvestorProfile = require('../models/InvestorProfile');
const Campaign = require('../models/Campaign');
const Milestone = require('../models/Milestone');
const Investment = require('../models/Investment');

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('MONGO_URI not set');
  process.exit(1);
}

const randomBytes32Hex = () => '0x' + crypto.randomBytes(32).toString('hex');

const numberWords = [
  'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen', 'Twenty'
];

async function seed() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to DB. Wiping collections...');

    await User.deleteMany({});
    await StartupProfile.deleteMany({});
    await InvestorProfile.deleteMany({});
    await Campaign.deleteMany({});
    await Milestone.deleteMany({});
    await Investment.deleteMany({});
    
    try {
      await mongoose.connection.collection('hitl_pending').deleteMany({});
      await mongoose.connection.collection('investor_memory').deleteMany({});
      await mongoose.connection.collection('ai_audit_logs').deleteMany({});
    } catch(e) {
      console.log('Skipping wiping of raw collections that might not exist.');
    }

    console.log('Data wiped. Starting seed...');

    const admin = await User.create({
      fullName: 'System Admin',
      email: 'admin@admin.com',
      passwordHash: 'Pass1234',
      role: 'admin',
      isEmailVerified: true,
      isActive: true,
    });
    console.log('Admin created.');

    const founders = [];
    for (let i = 1; i <= 5; i++) {
        const titleCaseNumber = numberWords[i-1];
        const founder = await User.create({
          fullName: `Founder ${titleCaseNumber}`,
          email: `founder${i}@founder.com`,
          passwordHash: 'Pass1234',
          role: 'startup',
          isEmailVerified: true,
          isActive: true,
        });
        founders.push(founder);

        const profile = await StartupProfile.create({
            userId: founder._id,
            startupName: `Startup ${titleCaseNumber}`,
            tagline: `Changing the world, one step at a time part ${i}.`,
            description: `We are the pioneers of Startup ${titleCaseNumber}. Bringing innovation in the fintech space to the next level. We specialize in scalable blockchain architecture.`,
            industry: 'fintech',
            fundingStage: 'seed',
            website: `https://startup${i}.example.com`,
            location: { city: 'Bengaluru', country: 'India' },
            foundedYear: 2023,
            teamSize: 5 + i,
            isVerified: false, 
            teamMembers: [
              {
                name: `Founder ${titleCaseNumber}`,
                role: 'CEO & Founder',
                bio: 'Visionary.',
              }
            ],
            documents: []
        });

        const campaign = await Campaign.create({
          startupProfileId: profile._id,
          userId: founder._id,
          title: `Startup ${titleCaseNumber} Seed Round`,
          // fundingGoal: INR display target (UI only — never used in ethers.parseEther)
          summary: `Raising ${2 + i} POL on-chain for operations and growth.`,
          fundingGoal: 500000,              // INR display only
          fundingGoalPOL: `${2 + i}.0`,     // actual on-chain goal in POL decimal
          fundingGoalWei: null,             // set at activation time
          currency: 'POL',
          minInvestment: 0.01,              // POL decimal display
          minInvestmentWei: null,           // set at activation time
          deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          status: 'active',
          milestoneCount: 2,
          milestonePercentages: [50, 50],
          currentMilestoneIndex: 0,
          currentRaised: 0,
          currentRaisedWei: '0',
          currentReleasedWei: '0',
          investorCount: 0,
          campaignKey: randomBytes32Hex(),
          isContractDeployed: false,
          tags: ['fintech', 'ai', 'blockchain']
        });

        await Milestone.insertMany([
          {
            campaignId: campaign._id,
            startupProfileId: profile._id,
            userId: founder._id,
            index: 0,
            title: 'Phase 1 MVP',
            description: 'Building MVP for the platform. This involves core algorithm design and user onboarding flows.',
            percentage: 50,
            estimatedAmount: campaign.fundingGoal * 0.5,
            status: 'submitted', 
            proofSubmission: {
                description: 'We built the MVP. Here are the docs.',
                documents: [],
            }
          },
          {
            campaignId: campaign._id,
            startupProfileId: profile._id,
            userId: founder._id,
            index: 1,
            title: 'Phase 2 Scale',
            description: 'Scaling the platform and mass marketing.',
            percentage: 50,
            estimatedAmount: campaign.fundingGoal * 0.5,
            status: 'pending'
          }
        ]);
    }
    console.log('5 Founders, profiles, campaigns, milestones created.');

    for (let i = 1; i <= 20; i++) {
        const titleCaseNumber = numberWords[i-1] || i.toString();
        const investor = await User.create({
            fullName: `Investor ${titleCaseNumber}`,
            email: `investor${i}@investor.com`,
            passwordHash: 'Pass1234',
            role: 'investor',
            isEmailVerified: true,
            isActive: true,
        });

        await InvestorProfile.create({
            userId: investor._id,
            firstName: 'Investor',
            lastName: titleCaseNumber,
            bio: 'Seed investor with diversified portfolio across emerging startups.',
            isVerified: true,
            verificationStatus: 'approved',
            verifiedAt: new Date()
        });
    }
    console.log('20 Investors created.');

    console.log('Seed completed successfully.');
    process.exit(0);
  } catch(err) {
    console.error(err);
    process.exit(1);
  }
}

seed();
