/**
 * test/InvestmentPlatform.test.js
 *
 * Comprehensive MVP test suite for InvestmentPlatform.sol
 * Run: npx hardhat test
 * Run with gas report: REPORT_GAS=true npx hardhat test
 */

const { expect }        = require('chai');
const { ethers }        = require('hardhat');
const { time }          = require('@nomicfoundation/hardhat-network-helpers');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Generate a random bytes32 campaignKey (matches backend generation). */
const randomKey = () => ethers.hexlify(ethers.randomBytes(32));

/** Convert MATIC to wei. */
const matic = (n) => ethers.parseEther(String(n));

/** 
 * Build a valid 5-element percentage array padded with zeros.
 * createCampaign requires exactly 5 elements with unused slots = 0.
 */
const padPercentages = (arr) => {
  const padded = [...arr];
  while (padded.length < 5) padded.push(0);
  return padded;
};

/** Unix timestamp N seconds from now. */
const inSeconds = (s) => Math.floor(Date.now() / 1000) + s;

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('InvestmentPlatform', function () {
  let contract;
  let owner;       // admin/operator
  let startup;     // startup wallet (receives milestone funds)
  let investor1;
  let investor2;
  let stranger;    // unprivileged address

  // Standard campaign parameters reused across tests
  const KEY          = randomKey();
  const FUNDING_GOAL = matic(50);
  const DEADLINE     = () => inSeconds(7 * 24 * 60 * 60); // 7 days from now
  const M_COUNT      = 3;
  const M_PCT        = padPercentages([30, 40, 30]);       // sums to 100

  beforeEach(async function () {
    [owner, startup, investor1, investor2, stranger] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory('InvestmentPlatform', owner);
    contract = await Factory.deploy();
    await contract.waitForDeployment();
  });

  // ── 1. Deployment ─────────────────────────────────────────────────────────

  describe('Deployment', function () {
    it('sets deployer as owner', async function () {
      expect(await contract.owner()).to.equal(owner.address);
    });
  });

  // ── 2. createCampaign ────────────────────────────────────────────────────

  describe('createCampaign', function () {
    it('creates a campaign with correct fields', async function () {
      await contract.createCampaign(
        KEY, startup.address, FUNDING_GOAL, DEADLINE(), M_COUNT, M_PCT
      );

      const c = await contract.getCampaign(KEY);
      expect(c.startupWallet).to.equal(startup.address);
      expect(c.fundingGoal).to.equal(FUNDING_GOAL);
      expect(c.milestoneCount).to.equal(M_COUNT);
      expect(c.currentMilestoneIndex).to.equal(0);
      expect(c.totalRaised).to.equal(0);
      expect(c.exists).to.be.true;
      expect(c.isOpen).to.be.true;
      // Percentages stored correctly
      expect(c.milestonePercentages[0]).to.equal(30);
      expect(c.milestonePercentages[1]).to.equal(40);
      expect(c.milestonePercentages[2]).to.equal(30);
      expect(c.milestonePercentages[3]).to.equal(0);
      expect(c.milestonePercentages[4]).to.equal(0);
    });

    it('emits CampaignCreated event', async function () {
      await expect(
        contract.createCampaign(KEY, startup.address, FUNDING_GOAL, DEADLINE(), M_COUNT, M_PCT)
      )
        .to.emit(contract, 'CampaignCreated')
        .withArgs(KEY, startup.address, FUNDING_GOAL, DEADLINE(), M_COUNT);
    });

    it('reverts on duplicate campaignKey', async function () {
      await contract.createCampaign(
        KEY, startup.address, FUNDING_GOAL, DEADLINE(), M_COUNT, M_PCT
      );
      await expect(
        contract.createCampaign(
          KEY, startup.address, FUNDING_GOAL, DEADLINE(), M_COUNT, M_PCT
        )
      ).to.be.revertedWith('InvestmentPlatform: Campaign already exists');
    });

    it('reverts if percentages do not sum to 100', async function () {
      await expect(
        contract.createCampaign(
          randomKey(), startup.address, FUNDING_GOAL, DEADLINE(), 2,
          padPercentages([40, 40])  // sums to 80
        )
      ).to.be.revertedWith('InvestmentPlatform: Milestone percentages must sum to 100');
    });

    it('reverts if an active milestone percentage is zero', async function () {
      await expect(
        contract.createCampaign(
          randomKey(), startup.address, FUNDING_GOAL, DEADLINE(), 2,
          padPercentages([100, 0]) // second active slot is 0 — invalid
        )
      ).to.be.revertedWith('InvestmentPlatform: Active milestone percentage must be > 0');
    });

    it('reverts if unused slots are non-zero', async function () {
      await expect(
        contract.createCampaign(
          randomKey(), startup.address, FUNDING_GOAL, DEADLINE(), 2,
          [50, 50, 10, 0, 0] // slot 2 is non-zero but milestoneCount is 2
        )
      ).to.be.revertedWith('InvestmentPlatform: Unused milestone slots must be 0');
    });

    it('reverts if milestoneCount is 0', async function () {
      await expect(
        contract.createCampaign(
          randomKey(), startup.address, FUNDING_GOAL, DEADLINE(), 0,
          padPercentages([])
        )
      ).to.be.revertedWith('InvestmentPlatform: milestoneCount must be between 1 and 5');
    });

    it('reverts if milestoneCount is 6', async function () {
      await expect(
        contract.createCampaign(
          randomKey(), startup.address, FUNDING_GOAL, DEADLINE(), 6,
          [20, 20, 20, 20, 20]
        )
      ).to.be.revertedWith('InvestmentPlatform: milestoneCount must be between 1 and 5');
    });

    it('reverts if deadline is in the past', async function () {
      const pastDeadline = inSeconds(-100);
      await expect(
        contract.createCampaign(
          randomKey(), startup.address, FUNDING_GOAL, pastDeadline, M_COUNT, M_PCT
        )
      ).to.be.revertedWith('InvestmentPlatform: Deadline must be in the future');
    });

    it('reverts if startup wallet is zero address', async function () {
      await expect(
        contract.createCampaign(
          randomKey(), ethers.ZeroAddress, FUNDING_GOAL, DEADLINE(), M_COUNT, M_PCT
        )
      ).to.be.revertedWith('InvestmentPlatform: Invalid startup wallet address');
    });

    it('reverts if called by non-owner', async function () {
      await expect(
        contract.connect(stranger).createCampaign(
          randomKey(), startup.address, FUNDING_GOAL, DEADLINE(), M_COUNT, M_PCT
        )
      ).to.be.revertedWith('InvestmentPlatform: Not authorized');
    });

    it('supports single-milestone campaign (100%)', async function () {
      const key = randomKey();
      await contract.createCampaign(
        key, startup.address, FUNDING_GOAL, DEADLINE(), 1, padPercentages([100])
      );
      const c = await contract.getCampaign(key);
      expect(c.milestoneCount).to.equal(1);
      expect(c.milestonePercentages[0]).to.equal(100);
    });

    it('supports maximum 5-milestone campaign', async function () {
      const key = randomKey();
      await contract.createCampaign(
        key, startup.address, FUNDING_GOAL, DEADLINE(), 5, [20, 20, 20, 20, 20]
      );
      const c = await contract.getCampaign(key);
      expect(c.milestoneCount).to.equal(5);
    });
  });

  // ── 3. invest ─────────────────────────────────────────────────────────────

  describe('invest', function () {
    beforeEach(async function () {
      await contract.createCampaign(
        KEY, startup.address, FUNDING_GOAL, DEADLINE(), M_COUNT, M_PCT
      );
    });

    it('records investment and updates totalRaised', async function () {
      await contract.connect(investor1).invest(KEY, { value: matic(10) });

      expect(await contract.getInvestment(KEY, investor1.address)).to.equal(matic(10));
      expect(await contract.getTotalRaised(KEY)).to.equal(matic(10));
    });

    it('accumulates multiple investments from same investor', async function () {
      await contract.connect(investor1).invest(KEY, { value: matic(5) });
      await contract.connect(investor1).invest(KEY, { value: matic(3) });

      expect(await contract.getInvestment(KEY, investor1.address)).to.equal(matic(8));
    });

    it('tracks investments from multiple investors independently', async function () {
      await contract.connect(investor1).invest(KEY, { value: matic(10) });
      await contract.connect(investor2).invest(KEY, { value: matic(20) });

      expect(await contract.getInvestment(KEY, investor1.address)).to.equal(matic(10));
      expect(await contract.getInvestment(KEY, investor2.address)).to.equal(matic(20));
      expect(await contract.getTotalRaised(KEY)).to.equal(matic(30));
    });

    it('emits InvestmentReceived event with updated totalRaised', async function () {
      await expect(
        contract.connect(investor1).invest(KEY, { value: matic(10) })
      )
        .to.emit(contract, 'InvestmentReceived')
        .withArgs(KEY, investor1.address, matic(10), matic(10));
    });

    it('reverts if campaign is closed', async function () {
      await contract.setCampaignOpen(KEY, false);
      await expect(
        contract.connect(investor1).invest(KEY, { value: matic(10) })
      ).to.be.revertedWith('InvestmentPlatform: Campaign is not open for investment');
    });

    it('reverts if deadline has passed', async function () {
      const key = randomKey();
      const shortDeadline = inSeconds(60); // 1 minute
      await contract.createCampaign(
        key, startup.address, matic(10), shortDeadline, 1, padPercentages([100])
      );

      // Advance chain time past deadline
      await time.increaseTo(shortDeadline + 1);

      await expect(
        contract.connect(investor1).invest(key, { value: matic(5) })
      ).to.be.revertedWith('InvestmentPlatform: Campaign investment deadline has passed');
    });

    it('reverts if investment amount is zero', async function () {
      await expect(
        contract.connect(investor1).invest(KEY, { value: 0 })
      ).to.be.revertedWith('InvestmentPlatform: Investment amount must be greater than zero');
    });

    it('holds MATIC in contract balance', async function () {
      await contract.connect(investor1).invest(KEY, { value: matic(15) });
      const contractBalance = await ethers.provider.getBalance(await contract.getAddress());
      expect(contractBalance).to.equal(matic(15));
    });

    it('reverts on direct MATIC send (use invest() instead)', async function () {
      await expect(
        investor1.sendTransaction({ to: await contract.getAddress(), value: matic(1) })
      ).to.be.revertedWith('InvestmentPlatform: Use invest() to send MATIC');
    });
  });

  // ── 4. releaseMilestone ───────────────────────────────────────────────────

  describe('releaseMilestone', function () {
    beforeEach(async function () {
      await contract.createCampaign(
        KEY, startup.address, FUNDING_GOAL, DEADLINE(), M_COUNT, M_PCT
      );
      // Fund the campaign: 30 MATIC
      await contract.connect(investor1).invest(KEY, { value: matic(30) });
    });

    it('releases milestone 0 and sends correct MATIC to startup', async function () {
      // 30 MATIC raised × 30% = 9 MATIC
      const startupBalanceBefore = await ethers.provider.getBalance(startup.address);

      await contract.releaseMilestone(KEY, 0);

      const startupBalanceAfter = await ethers.provider.getBalance(startup.address);
      expect(startupBalanceAfter - startupBalanceBefore).to.equal(matic(9));
    });

    it('increments currentMilestoneIndex after release', async function () {
      await contract.releaseMilestone(KEY, 0);
      const c = await contract.getCampaign(KEY);
      expect(c.currentMilestoneIndex).to.equal(1);
    });

    it('emits MilestoneReleased event with correct amount', async function () {
      await expect(contract.releaseMilestone(KEY, 0))
        .to.emit(contract, 'MilestoneReleased')
        .withArgs(KEY, 0, matic(9), startup.address); // 30 × 30% = 9
    });

    it('releases milestones sequentially', async function () {
      await contract.releaseMilestone(KEY, 0); // 30% of 30 = 9
      await contract.releaseMilestone(KEY, 1); // 40% of 30 = 12
      await contract.releaseMilestone(KEY, 2); // 30% of 30 = 9
      // Total: 30 MATIC released
    });

    it('emits CampaignCompleted on final milestone', async function () {
      await contract.releaseMilestone(KEY, 0);
      await contract.releaseMilestone(KEY, 1);
      await expect(contract.releaseMilestone(KEY, 2))
        .to.emit(contract, 'CampaignCompleted')
        .withArgs(KEY, matic(30));
    });

    it('closes campaign after final milestone', async function () {
      await contract.releaseMilestone(KEY, 0);
      await contract.releaseMilestone(KEY, 1);
      await contract.releaseMilestone(KEY, 2);
      const c = await contract.getCampaign(KEY);
      expect(c.isOpen).to.be.false;
    });

    it('reverts if milestoneIndex does not match currentMilestoneIndex', async function () {
      // Try to release index 1 before index 0 is released
      await expect(
        contract.releaseMilestone(KEY, 1)
      ).to.be.revertedWith('InvestmentPlatform: Milestone index does not match current index');
    });

    it('reverts after all milestones released', async function () {
      await contract.releaseMilestone(KEY, 0);
      await contract.releaseMilestone(KEY, 1);
      await contract.releaseMilestone(KEY, 2);

      // currentMilestoneIndex is now 3, milestoneCount is 3.
      // The 'All milestones have already been released' check fires before index mismatch.
      await expect(
        contract.releaseMilestone(KEY, 3)
      ).to.be.revertedWith('InvestmentPlatform: All milestones have already been released');
    });

    it('reverts if called by non-owner', async function () {
      await expect(
        contract.connect(stranger).releaseMilestone(KEY, 0)
      ).to.be.revertedWith('InvestmentPlatform: Not authorized');
    });
  });

  // ── 5. setCampaignOpen ────────────────────────────────────────────────────

  describe('setCampaignOpen', function () {
    beforeEach(async function () {
      await contract.createCampaign(
        KEY, startup.address, FUNDING_GOAL, DEADLINE(), M_COUNT, M_PCT
      );
    });

    it('closes a campaign', async function () {
      await contract.setCampaignOpen(KEY, false);
      const c = await contract.getCampaign(KEY);
      expect(c.isOpen).to.be.false;
    });

    it('reopens a closed campaign', async function () {
      await contract.setCampaignOpen(KEY, false);
      await contract.setCampaignOpen(KEY, true);
      const c = await contract.getCampaign(KEY);
      expect(c.isOpen).to.be.true;
    });

    it('emits CampaignStatusChanged event', async function () {
      await expect(contract.setCampaignOpen(KEY, false))
        .to.emit(contract, 'CampaignStatusChanged')
        .withArgs(KEY, false);
    });

    it('reverts if called by non-owner', async function () {
      await expect(
        contract.connect(stranger).setCampaignOpen(KEY, false)
      ).to.be.revertedWith('InvestmentPlatform: Not authorized');
    });

    it('reverts for non-existent campaign', async function () {
      await expect(
        contract.setCampaignOpen(randomKey(), false)
      ).to.be.revertedWith('InvestmentPlatform: Campaign not found');
    });
  });

  // ── 6. View Functions ─────────────────────────────────────────────────────

  describe('View functions', function () {
    it('getCampaign reverts for non-existent key', async function () {
      await expect(
        contract.getCampaign(randomKey())
      ).to.be.revertedWith('InvestmentPlatform: Campaign not found');
    });

    it('getTotalRaised reverts for non-existent key', async function () {
      await expect(
        contract.getTotalRaised(randomKey())
      ).to.be.revertedWith('InvestmentPlatform: Campaign not found');
    });

    it('getInvestment returns 0 for non-investor', async function () {
      await contract.createCampaign(
        KEY, startup.address, FUNDING_GOAL, DEADLINE(), M_COUNT, M_PCT
      );
      expect(await contract.getInvestment(KEY, stranger.address)).to.equal(0);
    });

    it('getInvestment returns 0 for non-existent campaign', async function () {
      expect(await contract.getInvestment(randomKey(), investor1.address)).to.equal(0);
    });
  });
});
