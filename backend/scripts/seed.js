require('colors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const crypto = require('crypto');

// Models
const User = require('../src/models/User');
const StartupProfile = require('../src/models/StartupProfile');
const Campaign = require('../src/models/Campaign');
const Milestone = require('../src/models/Milestone');
const Investment = require('../src/models/Investment');

// 1. Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env/.env') });
dotenv.config();

const connectDB = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI is not defined in environment variables');
    }
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 8000,
    });
    console.log(`[DB] MongoDB connected: ${conn.connection.host}`.cyan.bold);
  } catch (error) {
    console.error(`[DB] Connection failed: ${error.message}`.red.bold);
    process.exit(1);
  }
};

// ── Seed constants ─────────────────────────────────────────────────────────────
const DUMMY_PASSWORD = 'Pass1234';

// profileStage  → StartupProfile.fundingStage enum: pre_seed | seed | series_a | series_b | other
// campaignStage → Campaign.fundingStage      enum: pre-seed | seed | series-a | series-b | series-c | growth
const STARTUPS = [
  { name: 'EcoWatt',      industry: 'cleantech',   sector: 'Energy',       category: 'CleanTech',  profileStage: 'seed',      campaignStage: 'seed',     risk: 4, ret: 'high'    },
  { name: 'MediLink',     industry: 'healthtech',  sector: 'Healthcare',   category: 'HealthTech', profileStage: 'seed',      campaignStage: 'seed',     risk: 5, ret: 'medium'  },
  { name: 'EduChain',     industry: 'edtech',      sector: 'Education',    category: 'EdTech',     profileStage: 'seed',      campaignStage: 'seed',     risk: 3, ret: 'medium'  },
  { name: 'FinGrow',      industry: 'fintech',     sector: 'Finance',      category: 'FinTech',    profileStage: 'pre_seed',  campaignStage: 'pre-seed', risk: 6, ret: 'high'    },
  { name: 'AgriBoost',    industry: 'agritech',    sector: 'Agriculture',  category: 'AgriTech',   profileStage: 'pre_seed',  campaignStage: 'pre-seed', risk: 5, ret: 'medium'  },
  { name: 'CloudSync',    industry: 'saas',         sector: 'Technology',   category: 'SaaS',       profileStage: 'pre_seed',  campaignStage: 'pre-seed', risk: 4, ret: 'high'    },
  { name: 'Propertize',   industry: 'proptech',    sector: 'Real Estate',  category: 'PropTech',   profileStage: 'pre_seed',  campaignStage: 'pre-seed', risk: 6, ret: 'medium'  },
  { name: 'CyberShield',  industry: 'saas',         sector: 'Technology',   category: 'CyberSec',  profileStage: 'series_a',  campaignStage: 'series-a', risk: 3, ret: 'high'    },
  { name: 'AILogistics',  industry: 'saas',         sector: 'Technology',   category: 'AI & ML',   profileStage: 'series_a',  campaignStage: 'series-a', risk: 5, ret: 'moonshot' },
  { name: 'BioSynth',     industry: 'healthtech',  sector: 'Healthcare',   category: 'BioTech',    profileStage: 'series_a',  campaignStage: 'series-a', risk: 7, ret: 'moonshot' },
];

const MILESTONE_CONFIGS = [
  { count: 2, percentages: [50, 50] },
  { count: 3, percentages: [30, 40, 30] },
  { count: 4, percentages: [25, 25, 25, 25] },
  { count: 5, percentages: [20, 20, 20, 20, 20] },
];

// ── Main seed ──────────────────────────────────────────────────────────────────
const seedData = async () => {
  try {
    console.log('\n🌱 Starting Seed Process...'.yellow.bold);
    await connectDB();

    // ── Clear existing data ──────────────────────────────────────────────────
    console.log('🧹 Clearing existing data...'.yellow);
    await Promise.all([
      User.deleteMany({}),
      StartupProfile.deleteMany({}),
      Campaign.deleteMany({}),
      Milestone.deleteMany({}),
      Investment.deleteMany({}),
    ]);
    console.log('✅ Collections cleared.'.green);

    // ── 1. Admin ─────────────────────────────────────────────────────────────
    const admin = await User.create({
      fullName: 'System Admin',
      email: process.env.ADMIN_EMAIL || 'admin@enigmainvest.dev',
      passwordHash: process.env.ADMIN_PASSWORD || 'Admin@1234',
      role: 'admin',
      isEmailVerified: true,
    });
    console.log(`✅ Admin:    ${admin.email}`.green);

    // ── 2. Investors ─────────────────────────────────────────────────────────
    const investors = [];
    for (let i = 1; i <= 5; i++) {
      const inv = await User.create({
        fullName: `Investor ${i}`,
        email: `investor${i}@example.com`,
        passwordHash: DUMMY_PASSWORD,
        role: 'investor',
        isEmailVerified: true,
      });
      investors.push(inv);
    }
    console.log(`✅ Investors: investor1–5@example.com / ${DUMMY_PASSWORD}`.green);

    // ── 3. Startups + Profiles + Campaigns + Milestones ──────────────────────
    const campaignsList = [];

    for (let i = 0; i < 10; i++) {
      const s = STARTUPS[i];

      // User
      const startupUser = await User.create({
        fullName: `Founder ${i + 1}`,
        email: `startup${i + 1}@example.com`,
        passwordHash: DUMMY_PASSWORD,
        role: 'startup',
        isEmailVerified: true,
      });

      // Profile
      const startupProfile = await StartupProfile.create({
        userId: startupUser._id,
        startupName: s.name,
        tagline: `Transforming the ${s.industry} space — one product at a time.`,
        description: `${s.name} is a leading innovator in the ${s.industry} industry. We leverage modern technology for scalable, high-impact solutions that drive real-world change.`,
        industry: s.industry,
        fundingStage: s.profileStage,
        website: `https://${s.name.toLowerCase()}.example.com`,
        location: { city: 'Bengaluru', country: 'India' },
        foundedYear: 2020 + (i % 4),
        teamSize: 5 + i * 2,
        teamMembers: [
          { name: `Founder ${i + 1}`, role: 'CEO', bio: 'Visionary leader with 10 years of experience.' },
        ],
        documents: [
          { docType: 'pitch_deck', url: 'https://example.com/pitch.pdf', label: 'Pitch Deck 2026' },
        ],
        isVerified: i < 8,   // first 8 verified, last 2 pending
        verificationStatus: i < 8 ? 'approved' : 'pending',
        verifiedAt: i < 8 ? new Date() : null,
      });

      // Campaign — first 8 active, last 2 draft
      const mConfig = MILESTONE_CONFIGS[i % MILESTONE_CONFIGS.length];
      const fundingGoal = 1_000_000 + i * 500_000;
      const isActive = i < 8;

      const deadline = new Date();
      deadline.setDate(deadline.getDate() + 30 + i * 10);

      const campaign = await Campaign.create({
        startupProfileId: startupProfile._id,
        userId: startupUser._id,
        title: `${s.name} ${isActive ? 'Expansion' : 'Seed'} Round`,
        summary: `Raising ₹${(fundingGoal / 100_000).toFixed(0)} Lakh to scale operations and accelerate product development for ${s.name}.`,
        sector: s.sector,
        category: s.category,
        fundingStage: s.campaignStage,
        riskScore: s.risk,
        returnPotential: s.ret,
        fundingGoal,
        currency: 'INR',
        minInvestment: 5000,
        deadline,
        localStatus: isActive ? 'approved' : 'draft',
        onChainStatus: isActive ? 'active' : 'unregistered',
        campaignKey: '0x' + crypto.randomBytes(32).toString('hex'),
        milestoneCount: mConfig.count,
        milestonePercentages: mConfig.percentages,
        tags: [s.industry, 'scaling', 'impact'],
      });

      campaignsList.push({ campaign, mConfig, fundingGoal });

      // Milestones
      for (let m = 0; m < mConfig.count; m++) {
        const start = new Date();
        start.setDate(start.getDate() + m * 30);
        const end = new Date(start);
        end.setDate(end.getDate() + 30);

        await Milestone.create({
          campaignId: campaign._id,
          startupProfileId: startupProfile._id,
          userId: startupUser._id,
          milestoneIndex: m,
          title: `Milestone ${m + 1}: Phase ${m + 1} Delivery`,
          description: `Complete phase ${m + 1} objectives including development, testing, and deployment. Target: achieve core KPIs and stakeholder sign-off.`,
          percentage: mConfig.percentages[m],
          targetAmount: fundingGoal * mConfig.percentages[m] / 100,
          status: 'pending',
          targetDate: end,
        });
      }
    }
    console.log('✅ 10 startups + profiles + campaigns + milestones created.'.green);

    // ── 4. Investments ────────────────────────────────────────────────────────
    let totalInvestments = 0;

    for (const { campaign, fundingGoal } of campaignsList) {
      if (campaign.onChainStatus !== 'active') continue;

      const numInvestments = 1 + Math.floor(Math.random() * 3); // 1–3 per campaign
      let campaignRaised = 0;
      const investedUserIds = new Set();

      for (let j = 0; j < numInvestments; j++) {
        const investor = investors[j % investors.length];
        const amount = 50_000 + Math.floor(Math.random() * 20_000);

        await Investment.create({
          campaignId: campaign._id,
          startupProfileId: campaign.startupProfileId,
          investorUserId: investor._id,
          amount,
          currency: 'INR',
          chain: 'stub',
          status: 'confirmed',
          txHash: '0x' + crypto.randomBytes(32).toString('hex'),
          confirmedAt: new Date(),
          paymentId: `pay_stub_${crypto.randomBytes(4).toString('hex')}`,
          verificationNote: 'Seed stub investment',
        });

        campaignRaised += amount;
        investedUserIds.add(investor._id.toString());
        totalInvestments++;
      }

      await Campaign.findByIdAndUpdate(campaign._id, {
        currentRaised: campaignRaised,
        investorCount: investedUserIds.size,
      });
    }

    // Force campaign[0] to be fully funded as a demo showcase
    const { campaign: firstCampaign, fundingGoal: firstGoal } = campaignsList[0];
    await Campaign.findByIdAndUpdate(firstCampaign._id, {
      currentRaised: firstGoal,
      onChainStatus: 'funded',
      investorCount: 3,
    });
    await Investment.create({
      campaignId: firstCampaign._id,
      startupProfileId: firstCampaign.startupProfileId,
      investorUserId: investors[0]._id,
      amount: firstGoal,
      currency: 'INR',
      chain: 'stub',
      status: 'confirmed',
      txHash: '0x' + crypto.randomBytes(32).toString('hex'),
      confirmedAt: new Date(),
      verificationNote: 'Funded campaign seed — demo showcase',
    });
    totalInvestments++;

    console.log(`✅ ${totalInvestments} investments created.`.green);

    // ── Summary ───────────────────────────────────────────────────────────────
    console.log('\n🎉 Seeding Completed!'.magenta.bold);
    console.log('─'.repeat(52).grey);
    console.log('  Role      Email                          Password'.cyan);
    console.log('─'.repeat(52).grey);
    console.log(`  Admin     ${'admin@enigmainvest.dev'.padEnd(30)} Admin@1234`);
    console.log(`  Investor  ${'investor1–5@example.com'.padEnd(30)} Pass1234`);
    console.log(`  Startup   ${'startup1–10@example.com'.padEnd(30)} Pass1234`);
    console.log('─'.repeat(52).grey);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Seeding Failed:'.red.bold, error.message);
    if (error.errors) {
      Object.entries(error.errors).forEach(([field, err]) => {
        console.error(`   • ${field}: ${err.message}`.red);
      });
    }
    process.exit(1);
  }
};

seedData();
