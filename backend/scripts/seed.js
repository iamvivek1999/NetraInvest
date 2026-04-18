require('colors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Models
const User = require('../src/models/User');
const StartupProfile = require('../src/models/StartupProfile');
const Campaign = require('../src/models/Campaign');
const Milestone = require('../src/models/Milestone');
const Investment = require('../src/models/Investment');

// 1. Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env/.env') }); // try local nested first
dotenv.config(); // fallback

const connectDB = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI is not defined in environment variables');
    }
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`[DB] MongoDB connected: ${conn.connection.host}`.cyan.bold);
  } catch (error) {
    console.error(`[DB] Connection failed: ${error.message}`.red.bold);
    process.exit(1);
  }
};

const DUMMY_PASSWORD = 'Pass1234';

const industries = ['fintech', 'healthtech', 'edtech', 'ecommerce', 'agritech', 'saas', 'cleantech', 'proptech'];
const startupNames = [
  'EcoWatt', 'MediLink', 'EduChain', 'FinGrow', 'AgriBoost', 
  'CloudSync', 'Propertize', 'CyberShield', 'AILogistics', 'BioSynth'
];

const seedData = async () => {
  try {
    console.log('🌱 Starting Seed Process...'.yellow);

    await connectDB();

    console.log('🧹 Clearing existing data...'.yellow);
    await User.deleteMany({});
    await StartupProfile.deleteMany({});
    await Campaign.deleteMany({});
    await Milestone.deleteMany({});
    await Investment.deleteMany({});

    console.log('✅ Collections cleared.'.green);

    // ────────────────────────────────────────────────────────────────────────
    // 1. Create Admin
    // ────────────────────────────────────────────────────────────────────────
    const admin = await User.create({
      fullName: 'System Admin',
      email: process.env.ADMIN_EMAIL || 'admin@enigmainvest.dev',
      passwordHash: process.env.ADMIN_PASSWORD || 'Admin@1234',
      role: 'admin',
      isEmailVerified: true
    });
    console.log('✅ Admin user created.'.green);

    // ────────────────────────────────────────────────────────────────────────
    // 2. Create Investors
    // ────────────────────────────────────────────────────────────────────────
    const investors = [];
    for (let i = 1; i <= 5; i++) {
      const investor = await User.create({
        fullName: `Investor ${i}`,
        email: `investor${i}@example.com`,
        passwordHash: DUMMY_PASSWORD,
        role: 'investor',
        isEmailVerified: true
      });
      investors.push(investor);
    }
    console.log(`✅ 5 Investor accounts created.`.green);

    // ────────────────────────────────────────────────────────────────────────
    // 3. Create Startups & Profiles & Campaigns & Milestones
    // ────────────────────────────────────────────────────────────────────────
    const campaignsList = [];

    for (let i = 0; i < 10; i++) {
      // User
      const startupUser = await User.create({
        fullName: `Founder ${i+1}`,
        email: `startup${i+1}@example.com`,
        passwordHash: DUMMY_PASSWORD,
        role: 'startup',
        isEmailVerified: true
      });

      // Profile
      const startupProfile = await StartupProfile.create({
        userId: startupUser._id,
        startupName: startupNames[i],
        tagline: `Transforming the ${industries[i % industries.length]} space.`,
        description: `This is a comprehensive description for ${startupNames[i]}. We are dedicated to providing cutting-edge solutions in the ${industries[i % industries.length]} industry, leveraging modern tech for scalable impact.`,
        industry: industries[i % industries.length],
        fundingStage: i < 3 ? 'seed' : (i < 7 ? 'pre_seed' : 'series_a'),
        website: `https://${startupNames[i].toLowerCase()}.example.com`,
        location: { city: 'Bengaluru', country: 'India' },
        foundedYear: 2020 + (i % 4),
        teamSize: 5 + i * 2,
        teamMembers: [
          { name: `Founder ${i+1}`, role: 'CEO', bio: 'Visionary leader with 10 years of experience.' }
        ],
        documents: [
          { docType: 'pitch_deck', url: 'https://example.com/pitch.pdf', label: 'Pitch Deck 2026' }
        ],
        isVerified: true,
        verifiedAt: new Date()
      });

      // Campaign
      const milestoneConfigurations = [
        { count: 2, percentages: [50, 50] },
        { count: 3, percentages: [30, 40, 30] },
        { count: 4, percentages: [25, 25, 25, 25] },
        { count: 5, percentages: [20, 20, 20, 20, 20] },
      ];

      const configIndex = i % milestoneConfigurations.length;
      const mConfig = milestoneConfigurations[configIndex];
      const fundingGoal = 1000000 + i * 500000;

      // 8 active campaigns, 2 drafts
      const campaignStatus = i < 8 ? 'active' : 'draft';

      const deadline = new Date();
      deadline.setDate(deadline.getDate() + 30 + i * 10); // Future deadlines

      const campaign = await Campaign.create({
        startupProfileId: startupProfile._id,
        userId: startupUser._id,
        title: `${startupNames[i]} Expansion Round`,
        summary: `Raising funds to scale operations and accelerate product development for ${startupNames[i]}.`,
        fundingGoal: fundingGoal,
        currency: 'INR',
        minInvestment: 5000,
        deadline: deadline,
        status: campaignStatus,
        campaignKey: '0x' + require('crypto').randomBytes(32).toString('hex'),
        milestoneCount: mConfig.count,
        milestonePercentages: mConfig.percentages,
        tags: [industries[i % industries.length], 'scaling', 'tech']
      });

      campaignsList.push(campaign);

      // Milestones
      for (let m = 0; m < mConfig.count; m++) {
        await Milestone.create({
          campaignId: campaign._id,
          startupProfileId: startupProfile._id,
          userId: startupUser._id,
          index: m,
          title: `Milestone ${m+1}`,
          description: `Description for phase ${m+1}. Expected to complete core targets and deliverables.`.padEnd(20, '.'), 
          percentage: mConfig.percentages[m],
          estimatedAmount: fundingGoal * mConfig.percentages[m] / 100,
          status: 'pending'
        });
      }
    }
    console.log(`✅ 10 Startup accounts, profiles, campaigns, and milestones created.`.green);

    // ────────────────────────────────────────────────────────────────────────
    // 4. Create Investments (for active campaigns)
    // ────────────────────────────────────────────────────────────────────────
    let totalInvestments = 0;
    
    for (const campaign of campaignsList) {
      if (campaign.status === 'active') {
        // Add random investments
        const numInvestments = 1 + Math.floor(Math.random() * 3); // 1 to 3 investments per campaign
        
        let campaignRaised = 0;
        let campaignInvestorCount = 0;
        const investedUsers = new Set();

        for (let j = 0; j < numInvestments; j++) {
          const investor = investors[j % investors.length];
          const amount = 50000 + Math.floor(Math.random() * 20000); // 50k - 70k

          await Investment.create({
            campaignId: campaign._id,
            startupProfileId: campaign.startupProfileId,
            investorUserId: investor._id,
            amount: amount,
            currency: 'INR',
            chain: 'stub',
            status: 'confirmed',
            txHash: '0x' + require('crypto').randomBytes(32).toString('hex'),
            confirmedAt: new Date(),
            paymentId: `pay_stub_${Math.random().toString(36).substring(7)}`,
            verificationNote: 'Stub mode seed investment'
          });

          campaignRaised += amount;
          if (!investedUsers.has(investor._id.toString())) {
             campaignInvestorCount++;
             investedUsers.add(investor._id.toString());
          }
          totalInvestments++;
        }

        // Update campaign
        await Campaign.findByIdAndUpdate(campaign._id, {
          currentRaised: campaignRaised,
          investorCount: campaignInvestorCount,
          // Let's make 1 campaign fully funded for demo
          ...(campaignRaised >= campaign.fundingGoal ? { status: 'funded' } : {})
        });

      }
    }
    
    // Force one campaign to be 'funded' fully to verify that feature
    const firstCampaign = campaignsList[0];
    if(firstCampaign.status === 'active') {
        await Campaign.findByIdAndUpdate(firstCampaign._id, {
            currentRaised: firstCampaign.fundingGoal,
            status: 'funded',
            investorCount: firstCampaign.investorCount > 0 ? firstCampaign.investorCount : 1
        });
        await Investment.create({
            campaignId: firstCampaign._id,
            startupProfileId: firstCampaign.startupProfileId,
            investorUserId: investors[0]._id,
            amount: firstCampaign.fundingGoal,
            currency: 'INR',
            chain: 'stub',
            status: 'confirmed',
            txHash: '0x' + require('crypto').randomBytes(32).toString('hex'),
            confirmedAt: new Date(),
            verificationNote: 'Funded campaign seed'
        });
        totalInvestments++;
    }

    console.log(`✅ ${totalInvestments} Investments created.`.green);

    console.log('\n🎉 Seeding Completed Successfully!'.magenta.bold);
    console.log('You can now log in with the following credentials:'.cyan);
    console.log('Startup:  startup1@example.com / Pass1234');
    console.log('Investor: investor1@example.com / Pass1234');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Seeding Failed:'.red.bold, error);
    process.exit(1);
  }
};

seedData();
