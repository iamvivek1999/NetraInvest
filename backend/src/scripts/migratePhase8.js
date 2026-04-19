const mongoose = require('mongoose');
const env = require('../config/env');

// Connect to MongoDB
mongoose.connect(env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const Campaign = require('../models/Campaign');
const Investment = require('../models/Investment');
const Milestone = require('../models/Milestone');
const User = require('../models/User');

async function migrate() {
  console.log('Starting Phase 8 Database Migration...');

  try {
    // 1. Migrate Users (Normalize wallet address)
    console.log('Migrating Users...');
    const users = await User.find({ walletAddress: { $exists: true, $ne: null } });
    let usersUpdated = 0;
    for (const user of users) {
      if (user.walletAddress !== user.walletAddress.toLowerCase()) {
        user.walletAddress = user.walletAddress.toLowerCase();
        await user.save();
        usersUpdated++;
      }
    }
    console.log(`Updated ${usersUpdated} user wallet addresses.`);

    // 2. Migrate Investments
    console.log('Migrating Investments...');
    const investments = await Investment.find({});
    let investmentsUpdated = 0;
    for (const investment of investments) {
      let isUpdated = false;
      const invObj = investment.toObject();

      // Rename walletAddress -> investorWallet
      if (invObj.walletAddress && !invObj.investorWallet) {
        investment.investorWallet = invObj.walletAddress.toLowerCase();
        investment.set('walletAddress', undefined, { strict: false });
        isUpdated = true;
      }

      // Sync status
      if (invObj.status && !invObj.syncStatus) {
        if (invObj.status === 'completed' || invObj.status === 'confirmed') {
          investment.syncStatus = 'confirmed';
        } else if (invObj.status === 'pending') {
          investment.syncStatus = 'pending';
        } else if (invObj.status === 'failed' || invObj.status === 'cancelled') {
          investment.syncStatus = 'failed';
        } else {
            investment.syncStatus = 'pending';
        }
        investment.set('status', undefined, { strict: false });
        isUpdated = true;
      }

      if (isUpdated) {
        await investment.save();
        investmentsUpdated++;
      }
    }
    console.log(`Updated ${investmentsUpdated} investments.`);

    // 3. Migrate Milestones
    console.log('Migrating Milestones...');
    await Milestone.collection.dropIndex('campaignId_1_index_1').catch(() => {});
    const milestones = await Milestone.find({});
    let milestonesUpdated = 0;
    for (const milestone of milestones) {
      let isUpdated = false;
      const msObj = milestone.toObject();

      // Rename index -> milestoneIndex
      if (msObj.index !== undefined && msObj.milestoneIndex === undefined) {
        milestone.milestoneIndex = msObj.index;
        milestone.set('index', undefined, { strict: false });
        isUpdated = true;
      }

      // targetAmount fallback
      if (msObj.amount && !msObj.targetAmount) {
        milestone.targetAmount = msObj.amount;
        milestone.set('amount', undefined, { strict: false });
        isUpdated = true;
      } else if (!msObj.targetAmount) {
        milestone.targetAmount = 0;
        isUpdated = true;
      }

      // Split status -> reviewStatus, onChainStatus
      if (msObj.status) {
        const oldStatus = msObj.status;
        
        switch (oldStatus) {
          case 'draft':
            milestone.reviewStatus = 'draft';
            milestone.onChainStatus = 'unreleased';
            break;
          case 'submitted':
            milestone.reviewStatus = 'submitted';
            milestone.onChainStatus = 'unreleased';
            break;
          case 'in_review':
          case 'under_review':
            milestone.reviewStatus = 'under_review';
            milestone.onChainStatus = 'unreleased';
            break;
          case 'approved':
            milestone.reviewStatus = 'approved';
            milestone.onChainStatus = 'unreleased'; // Requires admin to trigger transaction to set 'released'
            break;
          case 'rejected':
            milestone.reviewStatus = 'rejected';
            milestone.onChainStatus = 'unreleased';
            break;
          case 'released':
          case 'completed':
            milestone.reviewStatus = 'approved';
            milestone.onChainStatus = 'released'; // Funds are disbursed
            break;
          case 'cancelled':
            milestone.reviewStatus = 'rejected';
            milestone.onChainStatus = 'unreleased';
            break;
          default:
            milestone.reviewStatus = 'pending';
            milestone.onChainStatus = 'unreleased';
        }
        
        milestone.set('status', undefined, { strict: false });
        isUpdated = true;
      }

      if (isUpdated) {
        await milestone.save();
        milestonesUpdated++;
      }
    }
    console.log(`Updated ${milestonesUpdated} milestones.`);

    // 4. Migrate Campaigns
    console.log('Migrating Campaigns...');
    const campaigns = await Campaign.find({});
    let campaignsUpdated = 0;
    for (const campaign of campaigns) {
      let isUpdated = false;
      const cmpObj = campaign.toObject();

      // currentRaisedWei -> totalRaisedWei
      if (cmpObj.currentRaisedWei && !cmpObj.totalRaisedWei) {
        campaign.totalRaisedWei = cmpObj.currentRaisedWei;
        campaign.set('currentRaisedWei', undefined, { strict: false });
        isUpdated = true;
      }

      // activationTxHash -> createCampaignTxHash
      if (cmpObj.activationTxHash && !cmpObj.createCampaignTxHash) {
        campaign.createCampaignTxHash = cmpObj.activationTxHash;
        campaign.set('activationTxHash', undefined, { strict: false });
        isUpdated = true;
      }

      // isContractDeployed -> mapping to onChainStatus
      const wasDeployed = cmpObj.isContractDeployed || (cmpObj.activationTxHash && cmpObj.activationTxHash.length > 0);
      campaign.set('isContractDeployed', undefined, { strict: false });

      // Fallbacks for missing required fields
      if (!cmpObj.sector) { campaign.sector = 'Technology'; isUpdated = true; }
      if (!cmpObj.category) { campaign.category = 'Tech'; isUpdated = true; }
      if (!cmpObj.fundingStage) { campaign.fundingStage = 'seed'; isUpdated = true; }
      if (cmpObj.riskScore == null) { campaign.riskScore = 5; isUpdated = true; }
      if (!cmpObj.returnPotential) { campaign.returnPotential = 'high'; isUpdated = true; }

      // Split status -> localStatus, onChainStatus
      if (cmpObj.status) {
        const oldStatus = cmpObj.status;
        
        switch (oldStatus) {
          case 'draft':
            campaign.localStatus = 'draft';
            campaign.onChainStatus = 'unregistered';
            break;
          case 'submitted':
            campaign.localStatus = 'submitted';
            campaign.onChainStatus = 'unregistered';
            break;
          case 'under_review':
            campaign.localStatus = 'under_review';
            campaign.onChainStatus = 'unregistered';
            break;
          case 'approved':
            campaign.localStatus = 'approved';
            campaign.onChainStatus = 'unregistered';
            break;
          case 'rejected':
            campaign.localStatus = 'rejected';
            campaign.onChainStatus = 'unregistered';
            break;
          case 'active':
            campaign.localStatus = 'approved'; // Usually active implies approved locally
            campaign.onChainStatus = 'active';
            break;
          case 'paused':
            campaign.localStatus = 'approved'; 
            campaign.onChainStatus = 'paused';
            break;
          case 'funded':
            campaign.localStatus = 'approved';
            campaign.onChainStatus = 'funded';
            break;
          case 'completed':
            campaign.localStatus = 'approved';
            campaign.onChainStatus = 'completed';
            break;
          case 'cancelled':
            campaign.localStatus = 'rejected'; // Or keeping whatever it was
            campaign.onChainStatus = 'cancelled';
            break;
          default:
            campaign.localStatus = 'draft';
            campaign.onChainStatus = 'unregistered';
        }
        
        // If the contract was deployed but onChainStatus is unregistered, force it to 'active'.
        // Or leave it alone if it's already active/funded/etc.
        if (wasDeployed && campaign.onChainStatus === 'unregistered') {
          campaign.onChainStatus = 'active';
        }

        campaign.set('status', undefined, { strict: false });
        isUpdated = true;
      }

      if (isUpdated) {
        await campaign.save();
        campaignsUpdated++;
      }
    }

    console.log(`Updated ${campaignsUpdated} campaigns.`);

    console.log('Phase 8 Database Migration Completed Successfully!');

  } catch (error) {
    console.error('Error during migration, aborting transaction...', error);
  } finally {
    mongoose.connection.close();
  }
}

migrate();
