/**
 * src/tests/helpers/seedHelpers.js
 *
 * Shared seed utilities for integration tests.
 * Provides factory functions that create fully-valid Mongoose documents
 * satisfying all model validators (enum checks, min-length strings, etc.)
 */

'use strict';

const LONG_DESC =
  'Test startup profile description for integration testing the Enigma platform. ' +
  'This text is deliberately long enough to pass the minimum 50-character validator.';

const CAMPAIGN_SUMMARY = 'An integration-test campaign on the Enigma Web3 platform.';

const createUser = async (User, { role = 'investor', ...overrides } = {}) => {
  return User.create({
    fullName: `Test ${role} ${Date.now()}`,
    email: `${role}-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
    passwordHash: 'TestPass1234',
    role,
    isEmailVerified: true,
    ...overrides,
  });
};

const createStartupProfile = async (StartupProfile, userId, overrides = {}) => {
  return StartupProfile.create({
    userId,
    startupName: `Test Startup ${Date.now()}`,
    tagline: 'Testing on Enigma',
    description: LONG_DESC,
    industry: 'fintech',
    fundingStage: 'seed',
    website: 'https://test-enigma.io',
    isVerified: true,
    verifiedAt: new Date(),
    ...overrides,
  });
};

/**
 * Create a minimal valid Campaign.
 *
 * Notes on investment limit fields:
 *  - minInvestment defaults to 1 (model default). Must be > 0.
 *  - maxInvestment must be <= fundingGoal if set.
 *  - We omit both limits here so the model uses its defaults without conflicts.
 *    Tests that check amount validation should set these explicitly.
 */
const createCampaign = async (Campaign, { startupProfileId, userId, onChainStatus = 'active', ...overrides } = {}) => {
  return Campaign.create({
    startupProfileId,
    userId,
    title: `Test Campaign ${Date.now()}`,
    summary: CAMPAIGN_SUMMARY,
    sector: 'Technology',
    category: 'Web3',
    fundingStage: 'seed',
    riskScore: 5,
    returnPotential: 'high',
    fundingGoal: 100,
    fundingGoalWei: '100000000000000000000',
    currency: 'POL',
    deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    onChainStatus,
    milestoneCount: 1,
    milestonePercentages: [100],
    // Note: minInvestment defaults to 1 from the model. Tests should send amounts >= 1.
    ...overrides,
  });
};

const seedCampaignWithInvestor = async (
  { User, Campaign, StartupProfile },
  campaignOverrides = {}
) => {
  const startupUser  = await createUser(User, { role: 'startup' });
  const profile      = await createStartupProfile(StartupProfile, startupUser._id);
  const campaign     = await createCampaign(Campaign, {
    startupProfileId: profile._id,
    userId: startupUser._id,
    ...campaignOverrides,
  });
  const investorUser = await createUser(User, { role: 'investor' });

  return { startupUser, profile, campaign, investorUser };
};

const seedActivatedCampaign = async (
  { User, Campaign, StartupProfile },
  { campaignKey = '0x' + 'b'.repeat(64), ...campaignOverrides } = {}
) => {
  const { startupUser, profile, campaign, investorUser } = await seedCampaignWithInvestor(
    { User, Campaign, StartupProfile },
    {
      campaignKey,
      isContractDeployed: true,
      contractAddress: '0x' + 'd'.repeat(40),
      ...campaignOverrides,
    }
  );
  return { startupUser, profile, campaign, investorUser };
};

module.exports = {
  LONG_DESC,
  CAMPAIGN_SUMMARY,
  createUser,
  createStartupProfile,
  createCampaign,
  seedCampaignWithInvestor,
  seedActivatedCampaign,
};
