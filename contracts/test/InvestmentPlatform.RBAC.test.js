/**
 * test/InvestmentPlatform.RBAC.test.js
 *
 * Specific tests for AccessControl and Role-Based separation of powers.
 */

const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('InvestmentPlatform RBAC', function () {
  let contract;
  let admin;
  let operator;
  let reviewer;
  let stranger;
  let startup;

  const DEFAULT_ADMIN_ROLE = ethers.ZeroHash;
  const OPERATOR_ROLE = ethers.id('OPERATOR_ROLE');
  const REVIEWER_ROLE = ethers.id('REVIEWER_ROLE');

  const KEY = ethers.hexlify(ethers.randomBytes(32));
  const GOAL = ethers.parseEther('10');
  const M_COUNT = 1;
  const M_PCT = [100, 0, 0, 0, 0];

  beforeEach(async function () {
    [admin, operator, reviewer, stranger, startup] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory('InvestmentPlatform', admin);
    contract = await Factory.deploy();
    await contract.waitForDeployment();

    // Grant roles
    await contract.grantRole(OPERATOR_ROLE, operator.address);
    await contract.grantRole(REVIEWER_ROLE, reviewer.address);
  });

  describe('Role Assignments', function () {
    it('grants admin role to deployer', async function () {
      expect(await contract.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.be.true;
    });

    it('grants reviewer role to deployer (for convenience)', async function () {
      expect(await contract.hasRole(REVIEWER_ROLE, admin.address)).to.be.true;
    });

    it('assigned operator role correctly', async function () {
      expect(await contract.hasRole(OPERATOR_ROLE, operator.address)).to.be.true;
    });

    it('stranger has no roles', async function () {
      expect(await contract.hasRole(DEFAULT_ADMIN_ROLE, stranger.address)).to.be.false;
      expect(await contract.hasRole(OPERATOR_ROLE, stranger.address)).to.be.false;
      expect(await contract.hasRole(REVIEWER_ROLE, stranger.address)).to.be.false;
    });
  });

  describe('Separation of Powers', function () {
    beforeEach(async function () {
      const deadline = Math.floor(Date.now() / 1000) + 86400;
      await contract.createCampaign(KEY, startup.address, GOAL, deadline, M_COUNT, M_PCT);
    });

    it('OPERATOR can submit evidence, but ADMIN/STRANGER cannot (unless granted)', async function () {
      const evi = ethers.id('evi');
      const sum = ethers.id('sum');

      // Stranger cannot submit (Order matters: test failure first to avoid state change if it were to pass)
      await expect(contract.connect(stranger).submitMilestoneEvidenceHash(KEY, 0, evi, sum))
        .to.be.revertedWithCustomError(contract, 'AccessControlUnauthorizedAccount')
        .withArgs(stranger.address, OPERATOR_ROLE);

      // Admin (without Operator role) cannot submit
      await expect(contract.connect(admin).submitMilestoneEvidenceHash(KEY, 0, evi, sum))
        .to.be.revertedWithCustomError(contract, 'AccessControlUnauthorizedAccount')
        .withArgs(admin.address, OPERATOR_ROLE);

      // Operator can submit
      await expect(contract.connect(operator).submitMilestoneEvidenceHash(KEY, 0, evi, sum)).to.not.be.reverted;
    });

    it('REVIEWER can approve and release, but OPERATOR cannot', async function () {
      const evi = ethers.id('evi');
      const sum = ethers.id('sum');

      // Invest to reach goal so release is possible
      await contract.connect(stranger).invest(KEY, { value: GOAL });

      // Setup: submit evidence
      await contract.connect(operator).submitMilestoneEvidenceHash(KEY, 0, evi, sum);

      // Operator cannot approve
      await expect(contract.connect(operator).approveMilestoneEvidence(KEY, 0))
        .to.be.revertedWithCustomError(contract, 'AccessControlUnauthorizedAccount')
        .withArgs(operator.address, REVIEWER_ROLE);

      // Reviewer can approve
      await expect(contract.connect(reviewer).approveMilestoneEvidence(KEY, 0)).to.not.be.reverted;

      // Operator cannot release
      await expect(contract.connect(operator).releaseMilestone(KEY, 0))
        .to.be.revertedWithCustomError(contract, 'AccessControlUnauthorizedAccount')
        .withArgs(operator.address, REVIEWER_ROLE);

      // Reviewer can release
      await expect(contract.connect(reviewer).releaseMilestone(KEY, 0)).to.not.be.reverted;
    });

    it('only ADMIN can pause/cancel campaigns', async function () {
      // Reviewer cannot pause
      await expect(contract.connect(reviewer).pauseCampaign(KEY))
        .to.be.revertedWithCustomError(contract, 'AccessControlUnauthorizedAccount')
        .withArgs(reviewer.address, DEFAULT_ADMIN_ROLE);

      // Admin can pause
      await expect(contract.connect(admin).pauseCampaign(KEY)).to.not.be.reverted;
    });
  });
});
