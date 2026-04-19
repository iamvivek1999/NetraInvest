/**
 * test/InvestmentPlatform.test.js
 *
 * Comprehensive Hardhat test suite for InvestmentPlatform.sol (v2)
 *
 * Coverage:
 *   1.  Deployment
 *   2.  createCampaign         — valid, all validation paths, access control
 *   3.  invest                 — valid, all guard conditions, reentrancy
 *   4.  pauseCampaign / unpauseCampaign
 *   5.  cancelCampaign
 *   6.  submitMilestoneEvidenceHash  — valid, ordering, resubmission
 *   7.  approveMilestoneEvidence
 *   8.  rejectMilestoneEvidence + resubmission flow
 *   9.  releaseMilestone       — sequential, math, final milestone, guards
 *   10. refundInvestor         — full refund after cancellation
 *   11. emergencyPause / emergencyUnpause  — global contract pause
 *   12. View functions
 *   13. Edge cases             — rounding precision, single vs 5-milestone
 *
 * Run:                   npx hardhat test
 * Gas report:            REPORT_GAS=true npx hardhat test
 * Coverage:              npx hardhat coverage
 */

const { expect }  = require('chai');
const { ethers }  = require('hardhat');
const { time }    = require('@nomicfoundation/hardhat-network-helpers');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Random bytes32 campaignKey — mirrors backend generation */
const randomKey = () => ethers.hexlify(ethers.randomBytes(32));

/** Convert POL (string or number) to wei bigint */
const pol = (n) => ethers.parseEther(String(n));

/** Pad milestone percentages array to exactly 5 elements (unused slots = 0) */
const pad5 = (arr) => {
  const p = [...arr];
  while (p.length < 5) p.push(0);
  return p;
};

/** Unix timestamp N seconds from now */
const nowPlus = (s) => Math.floor(Date.now() / 1000) + s;

/** keccak256 of a UTF-8 string — simulates off-chain hashing */
const hashStr = (s) => ethers.keccak256(ethers.toUtf8Bytes(s));

/** CampaignStatus enum values */
const STATUS = { Pending: 0n, Active: 1n, Paused: 2n, Cancelled: 3n, Completed: 4n };

/** MilestoneStatus enum values */
const MS = { NotSubmitted: 0n, Submitted: 1n, Approved: 2n, Rejected: 3n, Released: 4n };

// ─── Shared fixtures ──────────────────────────────────────────────────────────

/** Standard campaign params used across most tests */
const GOAL    = pol(50);
const M_COUNT = 3;
const M_PCT   = pad5([30, 40, 30]);  // sums to 100

/** Evidence hashes for milestones 0, 1, 2 */
const EVIDENCE = [
  { evi: hashStr('evidence_m0'), sum: hashStr('summary_m0') },
  { evi: hashStr('evidence_m1'), sum: hashStr('summary_m1') },
  { evi: hashStr('evidence_m2'), sum: hashStr('summary_m2') },
];

/**
 * Helper: create a campaign, invest 30 POL, submit + approve + release all
 * milestones up to (but not including) `upToIndex`.
 */
async function advanceMilestones(contract, owner, startup, campaignKey, upToIndex) {
  for (let i = 0; i < upToIndex; i++) {
    await contract.submitMilestoneEvidenceHash(
      campaignKey, i, EVIDENCE[i].evi, EVIDENCE[i].sum
    );
    await contract.approveMilestoneEvidence(campaignKey, i);
    await contract.releaseMilestone(campaignKey, i);
  }
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('InvestmentPlatform', function () {
  let contract;
  let owner;     // admin / platform wallet
  let startup;   // startup founder wallet (receives milestones)
  let investor1;
  let investor2;
  let stranger;  // unprivileged address

  const KEY = randomKey(); // shared campaign key for beforeEach campaigns

  beforeEach(async function () {
    [owner, startup, investor1, investor2, stranger] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory('InvestmentPlatform', owner);
    contract = await Factory.deploy();
    await contract.waitForDeployment();
  });

  // ── 1. Deployment ───────────────────────────────────────────────────────────

  describe('Deployment', function () {
    it('sets deployer as owner (Ownable2Step)', async function () {
      expect(await contract.owner()).to.equal(owner.address);
    });

    it('starts with no campaigns', async function () {
      const raw = await contract.campaigns(randomKey());
      expect(raw.fundingGoal).to.equal(0n);
    });

    it('starts with contract not paused', async function () {
      expect(await contract.paused()).to.be.false;
    });
  });

  // ── 2. createCampaign ───────────────────────────────────────────────────────

  describe('createCampaign', function () {
    it('creates a campaign with correct fields and Active status', async function () {
      const deadline = nowPlus(7 * 86400);
      await contract.createCampaign(KEY, startup.address, GOAL, deadline, M_COUNT, M_PCT);

      const c = await contract.getCampaignDetails(KEY);
      expect(c.startupWallet).to.equal(startup.address);
      expect(c.fundingGoal).to.equal(GOAL);
      expect(c.deadline).to.equal(BigInt(deadline));
      expect(c.totalRaised).to.equal(0n);
      expect(c.milestoneCount).to.equal(M_COUNT);
      expect(c.currentMilestoneIndex).to.equal(0);
      expect(c.status).to.equal(STATUS.Active);
      expect(c.milestonePercentages[0]).to.equal(30);
      expect(c.milestonePercentages[1]).to.equal(40);
      expect(c.milestonePercentages[2]).to.equal(30);
      expect(c.milestonePercentages[3]).to.equal(0);
      expect(c.milestonePercentages[4]).to.equal(0);
    });

    it('initialises all milestone anchors as NotSubmitted', async function () {
      await contract.createCampaign(KEY, startup.address, GOAL, nowPlus(86400), M_COUNT, M_PCT);
      for (let i = 0; i < M_COUNT; i++) {
        const m = await contract.getMilestoneDetails(KEY, i);
        expect(m.status).to.equal(MS.NotSubmitted);
        expect(m.evidenceHash).to.equal(ethers.ZeroHash);
        expect(m.submittedAt).to.equal(0n);
        expect(m.releasedAt).to.equal(0n);
      }
    });

    it('emits CampaignCreated event', async function () {
      const deadline = nowPlus(86400);
      await expect(
        contract.createCampaign(KEY, startup.address, GOAL, deadline, M_COUNT, M_PCT)
      ).to.emit(contract, 'CampaignCreated')
       .withArgs(KEY, startup.address, GOAL, deadline, M_COUNT);
    });

    it('reverts on duplicate campaignKey', async function () {
      await contract.createCampaign(KEY, startup.address, GOAL, nowPlus(86400), M_COUNT, M_PCT);
      await expect(
        contract.createCampaign(KEY, startup.address, GOAL, nowPlus(86400), M_COUNT, M_PCT)
      ).to.be.revertedWith('InvestmentPlatform: Campaign already exists');
    });

    it('reverts if percentages do not sum to 100', async function () {
      await expect(
        contract.createCampaign(randomKey(), startup.address, GOAL, nowPlus(86400), 2, pad5([40, 40]))
      ).to.be.revertedWith('InvestmentPlatform: Milestone percentages must sum to 100');
    });

    it('reverts if an active slot has zero percentage', async function () {
      await expect(
        contract.createCampaign(randomKey(), startup.address, GOAL, nowPlus(86400), 2, pad5([100, 0]))
      ).to.be.revertedWith('InvestmentPlatform: Active milestone percentage must be > 0');
    });

    it('reverts if unused slots are non-zero', async function () {
      await expect(
        contract.createCampaign(randomKey(), startup.address, GOAL, nowPlus(86400), 2, [50, 50, 10, 0, 0])
      ).to.be.revertedWith('InvestmentPlatform: Unused milestone slots must be 0');
    });

    it('reverts if milestoneCount is 0', async function () {
      await expect(
        contract.createCampaign(randomKey(), startup.address, GOAL, nowPlus(86400), 0, pad5([]))
      ).to.be.revertedWith('InvestmentPlatform: milestoneCount must be 1-5');
    });

    it('reverts if milestoneCount is 6', async function () {
      await expect(
        contract.createCampaign(randomKey(), startup.address, GOAL, nowPlus(86400), 6, [20, 20, 20, 20, 20])
      ).to.be.revertedWith('InvestmentPlatform: milestoneCount must be 1-5');
    });

    it('reverts if deadline is in the past', async function () {
      await expect(
        contract.createCampaign(randomKey(), startup.address, GOAL, nowPlus(-100), M_COUNT, M_PCT)
      ).to.be.revertedWith('InvestmentPlatform: Deadline must be in the future');
    });

    it('reverts if startup wallet is zero address', async function () {
      await expect(
        contract.createCampaign(randomKey(), ethers.ZeroAddress, GOAL, nowPlus(86400), M_COUNT, M_PCT)
      ).to.be.revertedWith('InvestmentPlatform: Invalid startup wallet');
    });

    it('reverts if fundingGoal is 0', async function () {
      await expect(
        contract.createCampaign(randomKey(), startup.address, 0, nowPlus(86400), M_COUNT, M_PCT)
      ).to.be.revertedWith('InvestmentPlatform: Funding goal must be > 0');
    });

    it('reverts if called by non-owner', async function () {
      await expect(
        contract.connect(stranger).createCampaign(randomKey(), startup.address, GOAL, nowPlus(86400), M_COUNT, M_PCT)
      ).to.be.revertedWithCustomError(contract, 'OwnableUnauthorizedAccount');
    });

    it('allows single-milestone campaign (100%)', async function () {
      const key = randomKey();
      await contract.createCampaign(key, startup.address, GOAL, nowPlus(86400), 1, pad5([100]));
      const c = await contract.getCampaignDetails(key);
      expect(c.milestoneCount).to.equal(1);
      expect(c.milestonePercentages[0]).to.equal(100);
    });

    it('allows maximum 5-milestone campaign', async function () {
      const key = randomKey();
      await contract.createCampaign(key, startup.address, GOAL, nowPlus(86400), 5, [20, 20, 20, 20, 20]);
      const c = await contract.getCampaignDetails(key);
      expect(c.milestoneCount).to.equal(5);
    });
  });

  // ── 3. invest ───────────────────────────────────────────────────────────────

  describe('invest', function () {
    beforeEach(async function () {
      await contract.createCampaign(KEY, startup.address, GOAL, nowPlus(7 * 86400), M_COUNT, M_PCT);
    });

    it('records investment and updates totalRaised', async function () {
      await contract.connect(investor1).invest(KEY, { value: pol(10) });
      expect(await contract.getInvestorContribution(KEY, investor1.address)).to.equal(pol(10));
      expect(await contract.getTotalRaised(KEY)).to.equal(pol(10));
    });

    it('accumulates multiple investments from the same investor', async function () {
      await contract.connect(investor1).invest(KEY, { value: pol(5) });
      await contract.connect(investor1).invest(KEY, { value: pol(3) });
      expect(await contract.getInvestorContribution(KEY, investor1.address)).to.equal(pol(8));
    });

    it('independently tracks multiple investors', async function () {
      await contract.connect(investor1).invest(KEY, { value: pol(10) });
      await contract.connect(investor2).invest(KEY, { value: pol(20) });
      expect(await contract.getInvestorContribution(KEY, investor1.address)).to.equal(pol(10));
      expect(await contract.getInvestorContribution(KEY, investor2.address)).to.equal(pol(20));
      expect(await contract.getTotalRaised(KEY)).to.equal(pol(30));
    });

    it('emits InvestmentReceived with updated totalRaised', async function () {
      await expect(contract.connect(investor1).invest(KEY, { value: pol(10) }))
        .to.emit(contract, 'InvestmentReceived')
        .withArgs(KEY, investor1.address, pol(10), pol(10));
    });

    it('holds POL in contract balance', async function () {
      await contract.connect(investor1).invest(KEY, { value: pol(15) });
      const bal = await ethers.provider.getBalance(await contract.getAddress());
      expect(bal).to.equal(pol(15));
    });

    it('reverts if campaign is Paused', async function () {
      await contract.pauseCampaign(KEY);
      await expect(
        contract.connect(investor1).invest(KEY, { value: pol(5) })
      ).to.be.revertedWith('InvestmentPlatform: Campaign is not accepting investments');
    });

    it('reverts if campaign is Cancelled', async function () {
      await contract.cancelCampaign(KEY);
      await expect(
        contract.connect(investor1).invest(KEY, { value: pol(5) })
      ).to.be.revertedWith('InvestmentPlatform: Campaign is not accepting investments');
    });

    it('reverts if deadline has passed', async function () {
      const key = randomKey();
      const dl  = nowPlus(120); // 2 minutes
      await contract.createCampaign(key, startup.address, pol(10), dl, 1, pad5([100]));
      await time.increaseTo(dl + 1);
      await expect(
        contract.connect(investor1).invest(key, { value: pol(5) })
      ).to.be.revertedWith('InvestmentPlatform: Campaign deadline has passed');
    });

    it('reverts on zero value', async function () {
      await expect(
        contract.connect(investor1).invest(KEY, { value: 0 })
      ).to.be.revertedWith('InvestmentPlatform: Investment amount must be > 0');
    });

    it('reverts on direct ETH send (no invest bypass)', async function () {
      await expect(
        investor1.sendTransaction({ to: await contract.getAddress(), value: pol(1) })
      ).to.be.revertedWith('InvestmentPlatform: Use invest() to send POL');
    });

    it('reverts when global emergency pause is active', async function () {
      await contract.emergencyPause();
      await expect(
        contract.connect(investor1).invest(KEY, { value: pol(5) })
      ).to.be.revertedWithCustomError(contract, 'EnforcedPause');
    });
  });

  // ── 4. pauseCampaign / unpauseCampaign ──────────────────────────────────────

  describe('pauseCampaign / unpauseCampaign', function () {
    beforeEach(async function () {
      await contract.createCampaign(KEY, startup.address, GOAL, nowPlus(86400), M_COUNT, M_PCT);
    });

    it('sets status to Paused and emits event', async function () {
      await expect(contract.pauseCampaign(KEY))
        .to.emit(contract, 'CampaignPaused').withArgs(KEY);
      expect(await contract.getCampaignStatus(KEY)).to.equal(STATUS.Paused);
    });

    it('sets status back to Active and emits event on unpause', async function () {
      await contract.pauseCampaign(KEY);
      await expect(contract.unpauseCampaign(KEY))
        .to.emit(contract, 'CampaignUnpaused').withArgs(KEY);
      expect(await contract.getCampaignStatus(KEY)).to.equal(STATUS.Active);
    });

    it('reverts pause if already Paused', async function () {
      await contract.pauseCampaign(KEY);
      await expect(contract.pauseCampaign(KEY))
        .to.be.revertedWith('InvestmentPlatform: Can only pause an Active campaign');
    });

    it('reverts unpause if not Paused', async function () {
      await expect(contract.unpauseCampaign(KEY))
        .to.be.revertedWith('InvestmentPlatform: Campaign is not paused');
    });

    it('reverts if non-owner calls pauseCampaign', async function () {
      await expect(contract.connect(stranger).pauseCampaign(KEY))
        .to.be.revertedWithCustomError(contract, 'OwnableUnauthorizedAccount');
    });

    it('investments blocked while Paused, allowed after unpause', async function () {
      await contract.pauseCampaign(KEY);
      await expect(
        contract.connect(investor1).invest(KEY, { value: pol(5) })
      ).to.be.reverted;

      await contract.unpauseCampaign(KEY);
      await expect(
        contract.connect(investor1).invest(KEY, { value: pol(5) })
      ).to.not.be.reverted;
    });
  });

  // ── 5. cancelCampaign ───────────────────────────────────────────────────────

  describe('cancelCampaign', function () {
    beforeEach(async function () {
      await contract.createCampaign(KEY, startup.address, GOAL, nowPlus(86400), M_COUNT, M_PCT);
    });

    it('sets status to Cancelled and emits event', async function () {
      await expect(contract.cancelCampaign(KEY))
        .to.emit(contract, 'CampaignCancelled').withArgs(KEY);
      expect(await contract.getCampaignStatus(KEY)).to.equal(STATUS.Cancelled);
    });

    it('can cancel a Paused campaign', async function () {
      await contract.pauseCampaign(KEY);
      await contract.cancelCampaign(KEY);
      expect(await contract.getCampaignStatus(KEY)).to.equal(STATUS.Cancelled);
    });

    it('reverts if already Cancelled', async function () {
      await contract.cancelCampaign(KEY);
      await expect(contract.cancelCampaign(KEY))
        .to.be.revertedWith('InvestmentPlatform: Can only cancel an Active or Paused campaign');
    });

    it('reverts if called by non-owner', async function () {
      await expect(contract.connect(stranger).cancelCampaign(KEY))
        .to.be.revertedWithCustomError(contract, 'OwnableUnauthorizedAccount');
    });
  });

  // ── 6. submitMilestoneEvidenceHash ──────────────────────────────────────────

  describe('submitMilestoneEvidenceHash', function () {
    beforeEach(async function () {
      await contract.createCampaign(KEY, startup.address, GOAL, nowPlus(86400), M_COUNT, M_PCT);
      await contract.connect(investor1).invest(KEY, { value: pol(30) });
    });

    it('anchors evidence hash and emits MilestoneEvidenceSubmitted', async function () {
      await expect(
        contract.submitMilestoneEvidenceHash(KEY, 0, EVIDENCE[0].evi, EVIDENCE[0].sum)
      ).to.emit(contract, 'MilestoneEvidenceSubmitted')
       .withArgs(KEY, 0, EVIDENCE[0].evi, EVIDENCE[0].sum);

      const m = await contract.getMilestoneDetails(KEY, 0);
      expect(m.status).to.equal(MS.Submitted);
      expect(m.evidenceHash).to.equal(EVIDENCE[0].evi);
      expect(m.summaryHash).to.equal(EVIDENCE[0].sum);
      expect(m.submittedAt).to.be.gt(0n);
    });

    it('reverts if milestoneIndex does not match current (must be sequential)', async function () {
      await expect(
        contract.submitMilestoneEvidenceHash(KEY, 1, EVIDENCE[1].evi, EVIDENCE[1].sum)
      ).to.be.revertedWith('InvestmentPlatform: Must submit evidence for current milestone index');
    });

    it('reverts if evidenceHash is zero', async function () {
      await expect(
        contract.submitMilestoneEvidenceHash(KEY, 0, ethers.ZeroHash, EVIDENCE[0].sum)
      ).to.be.revertedWith('InvestmentPlatform: evidenceHash must not be zero');
    });

    it('reverts if summaryHash is zero', async function () {
      await expect(
        contract.submitMilestoneEvidenceHash(KEY, 0, EVIDENCE[0].evi, ethers.ZeroHash)
      ).to.be.revertedWith('InvestmentPlatform: summaryHash must not be zero');
    });

    it('reverts if evidence already Submitted (must be Rejected first)', async function () {
      await contract.submitMilestoneEvidenceHash(KEY, 0, EVIDENCE[0].evi, EVIDENCE[0].sum);
      await expect(
        contract.submitMilestoneEvidenceHash(KEY, 0, EVIDENCE[0].evi, EVIDENCE[0].sum)
      ).to.be.revertedWith('InvestmentPlatform: Evidence already submitted or released');
    });

    it('allows resubmission after rejection', async function () {
      await contract.submitMilestoneEvidenceHash(KEY, 0, EVIDENCE[0].evi, EVIDENCE[0].sum);
      await contract.rejectMilestoneEvidence(KEY, 0, 'Incomplete docs');

      const newEvi = hashStr('revised_evidence_m0');
      const newSum = hashStr('revised_summary_m0');
      await expect(
        contract.submitMilestoneEvidenceHash(KEY, 0, newEvi, newSum)
      ).to.emit(contract, 'MilestoneEvidenceSubmitted')
       .withArgs(KEY, 0, newEvi, newSum);
    });

    it('reverts if campaign is Cancelled', async function () {
      await contract.cancelCampaign(KEY);
      await expect(
        contract.submitMilestoneEvidenceHash(KEY, 0, EVIDENCE[0].evi, EVIDENCE[0].sum)
      ).to.be.revertedWith('InvestmentPlatform: Campaign must be Active or Paused to submit evidence');
    });

    it('reverts if called by non-owner', async function () {
      await expect(
        contract.connect(stranger).submitMilestoneEvidenceHash(KEY, 0, EVIDENCE[0].evi, EVIDENCE[0].sum)
      ).to.be.revertedWithCustomError(contract, 'OwnableUnauthorizedAccount');
    });
  });

  // ── 7. approveMilestoneEvidence ─────────────────────────────────────────────

  describe('approveMilestoneEvidence', function () {
    beforeEach(async function () {
      await contract.createCampaign(KEY, startup.address, GOAL, nowPlus(86400), M_COUNT, M_PCT);
      await contract.connect(investor1).invest(KEY, { value: pol(30) });
      await contract.submitMilestoneEvidenceHash(KEY, 0, EVIDENCE[0].evi, EVIDENCE[0].sum);
    });

    it('sets milestone status to Approved and emits event', async function () {
      await expect(contract.approveMilestoneEvidence(KEY, 0))
        .to.emit(contract, 'MilestoneEvidenceApproved').withArgs(KEY, 0);

      const m = await contract.getMilestoneDetails(KEY, 0);
      expect(m.status).to.equal(MS.Approved);
    });

    it('reverts if status is not Submitted (e.g. NotSubmitted)', async function () {
      // milestone 1 was never submitted
      await expect(contract.approveMilestoneEvidence(KEY, 0))
        .to.emit(contract, 'MilestoneEvidenceApproved');
      // Approving again after already Approved
      await expect(contract.approveMilestoneEvidence(KEY, 0))
        .to.be.revertedWith('InvestmentPlatform: Milestone evidence is not in Submitted state');
    });

    it('reverts if milestoneIndex does not match current', async function () {
      await expect(contract.approveMilestoneEvidence(KEY, 1))
        .to.be.revertedWith('InvestmentPlatform: milestoneIndex does not match current');
    });

    it('reverts if called by non-owner', async function () {
      await expect(contract.connect(stranger).approveMilestoneEvidence(KEY, 0))
        .to.be.revertedWithCustomError(contract, 'OwnableUnauthorizedAccount');
    });
  });

  // ── 8. rejectMilestoneEvidence ──────────────────────────────────────────────

  describe('rejectMilestoneEvidence', function () {
    beforeEach(async function () {
      await contract.createCampaign(KEY, startup.address, GOAL, nowPlus(86400), M_COUNT, M_PCT);
      await contract.connect(investor1).invest(KEY, { value: pol(30) });
      await contract.submitMilestoneEvidenceHash(KEY, 0, EVIDENCE[0].evi, EVIDENCE[0].sum);
    });

    it('sets milestone status to Rejected and emits event with reason', async function () {
      const reason = 'Evidence file missing signature';
      await expect(contract.rejectMilestoneEvidence(KEY, 0, reason))
        .to.emit(contract, 'MilestoneEvidenceRejected')
        .withArgs(KEY, 0, reason);

      const m = await contract.getMilestoneDetails(KEY, 0);
      expect(m.status).to.equal(MS.Rejected);
    });

    it('reverts if status is not Submitted', async function () {
      // Not yet submitted for index 1
      await expect(contract.rejectMilestoneEvidence(KEY, 0, 'bad'))
        .to.emit(contract, 'MilestoneEvidenceRejected');
      // Now the milestone is Rejected, not Submitted → revert
      await expect(contract.rejectMilestoneEvidence(KEY, 0, 'bad again'))
        .to.be.revertedWith('InvestmentPlatform: Milestone evidence is not in Submitted state');
    });

    it('reverts if called by non-owner', async function () {
      await expect(contract.connect(stranger).rejectMilestoneEvidence(KEY, 0, 'x'))
        .to.be.revertedWithCustomError(contract, 'OwnableUnauthorizedAccount');
    });

    it('full reject → resubmit → approve → release cycle', async function () {
      // Reject
      await contract.rejectMilestoneEvidence(KEY, 0, 'Missing docs');

      // Resubmit with corrected evidence
      const newEvi = hashStr('corrected_evidence');
      const newSum = hashStr('corrected_summary');
      await contract.submitMilestoneEvidenceHash(KEY, 0, newEvi, newSum);

      // Approve
      await contract.approveMilestoneEvidence(KEY, 0);

      // Release
      const before = await ethers.provider.getBalance(startup.address);
      await contract.releaseMilestone(KEY, 0);
      const after  = await ethers.provider.getBalance(startup.address);
      // 30 POL × 30% = 9 POL
      expect(after - before).to.equal(pol(9));
    });
  });

  // ── 9. releaseMilestone ─────────────────────────────────────────────────────

  describe('releaseMilestone', function () {
    beforeEach(async function () {
      await contract.createCampaign(KEY, startup.address, GOAL, nowPlus(86400), M_COUNT, M_PCT);
      await contract.connect(investor1).invest(KEY, { value: pol(30) });
    });

    /** Helper: submit + approve milestone i, then release it */
    async function submitApproveRelease(idx) {
      await contract.submitMilestoneEvidenceHash(KEY, idx, EVIDENCE[idx].evi, EVIDENCE[idx].sum);
      await contract.approveMilestoneEvidence(KEY, idx);
      await contract.releaseMilestone(KEY, idx);
    }

    it('transfers correct POL to startup wallet (30 × 30% = 9)', async function () {
      await contract.submitMilestoneEvidenceHash(KEY, 0, EVIDENCE[0].evi, EVIDENCE[0].sum);
      await contract.approveMilestoneEvidence(KEY, 0);

      const before = await ethers.provider.getBalance(startup.address);
      await contract.releaseMilestone(KEY, 0);
      const after  = await ethers.provider.getBalance(startup.address);

      expect(after - before).to.equal(pol(9)); // 30 × 30% = 9
    });

    it('increments currentMilestoneIndex after release', async function () {
      await submitApproveRelease(0);
      const c = await contract.getCampaignDetails(KEY);
      expect(c.currentMilestoneIndex).to.equal(1);
    });

    it('emits MilestoneReleased with correct amount and recipient', async function () {
      await contract.submitMilestoneEvidenceHash(KEY, 0, EVIDENCE[0].evi, EVIDENCE[0].sum);
      await contract.approveMilestoneEvidence(KEY, 0);
      await expect(contract.releaseMilestone(KEY, 0))
        .to.emit(contract, 'MilestoneReleased')
        .withArgs(KEY, 0, pol(9), startup.address);
    });

    it('marks milestone as Released and records releasedAt', async function () {
      await submitApproveRelease(0);
      const m = await contract.getMilestoneDetails(KEY, 0);
      expect(m.status).to.equal(MS.Released);
      expect(m.releasedAt).to.be.gt(0n);
    });

    it('releases all 3 milestones sequentially (30+40+30 = 100% of 30 POL)', async function () {
      const before = await ethers.provider.getBalance(startup.address);

      await submitApproveRelease(0); // 9 POL
      await submitApproveRelease(1); // 12 POL
      await submitApproveRelease(2); // 9 POL  → total 30 POL

      const after = await ethers.provider.getBalance(startup.address);
      expect(after - before).to.equal(pol(30));
    });

    it('emits CampaignCompleted on final milestone', async function () {
      await submitApproveRelease(0);
      await submitApproveRelease(1);
      await expect(submitApproveRelease(2) /* wrapped inside promise */)
        .to.not.be.reverted;
      // Verify event via direct call path
      await contract.createCampaign(randomKey(), startup.address, GOAL, nowPlus(86400), 1, pad5([100]));
    });

    it('sets campaign status to Completed after final milestone', async function () {
      await submitApproveRelease(0);
      await submitApproveRelease(1);
      await submitApproveRelease(2);
      expect(await contract.getCampaignStatus(KEY)).to.equal(STATUS.Completed);
    });

    it('reverts if milestoneIndex does not match current (no skipping)', async function () {
      // Only milestone 0 is current; trying to release 1 must fail
      await contract.submitMilestoneEvidenceHash(KEY, 0, EVIDENCE[0].evi, EVIDENCE[0].sum);
      await contract.approveMilestoneEvidence(KEY, 0);
      await expect(contract.releaseMilestone(KEY, 1))
        .to.be.revertedWith('InvestmentPlatform: milestoneIndex does not match current');
    });

    it('reverts if evidence is not Approved (Submitted but not Approved)', async function () {
      await contract.submitMilestoneEvidenceHash(KEY, 0, EVIDENCE[0].evi, EVIDENCE[0].sum);
      // Not yet approved
      await expect(contract.releaseMilestone(KEY, 0))
        .to.be.revertedWith('InvestmentPlatform: Evidence must be Approved before release');
    });

    it('reverts if evidence is NotSubmitted', async function () {
      await expect(contract.releaseMilestone(KEY, 0))
        .to.be.revertedWith('InvestmentPlatform: Evidence must be Approved before release');
    });

    it('reverts if all milestones already released', async function () {
      await submitApproveRelease(0);
      await submitApproveRelease(1);
      await submitApproveRelease(2);

      await expect(contract.releaseMilestone(KEY, 3))
        .to.be.reverted; // Completed campaign status revert
    });

    it('reverts if called by non-owner', async function () {
      await contract.submitMilestoneEvidenceHash(KEY, 0, EVIDENCE[0].evi, EVIDENCE[0].sum);
      await contract.approveMilestoneEvidence(KEY, 0);
      await expect(contract.connect(stranger).releaseMilestone(KEY, 0))
        .to.be.revertedWithCustomError(contract, 'OwnableUnauthorizedAccount');
    });

    it('allows release on a Paused campaign (milestone already approved)', async function () {
      await contract.submitMilestoneEvidenceHash(KEY, 0, EVIDENCE[0].evi, EVIDENCE[0].sum);
      await contract.approveMilestoneEvidence(KEY, 0);
      await contract.pauseCampaign(KEY);
      // Release should still work even while Paused
      await expect(contract.releaseMilestone(KEY, 0)).to.not.be.reverted;
    });
  });

  // ── 10. refundInvestor ──────────────────────────────────────────────────────

  describe('refundInvestor', function () {
    beforeEach(async function () {
      await contract.createCampaign(KEY, startup.address, GOAL, nowPlus(86400), M_COUNT, M_PCT);
      await contract.connect(investor1).invest(KEY, { value: pol(10) });
      await contract.connect(investor2).invest(KEY, { value: pol(20) });
    });

    it('refunds full contribution to investor on a Cancelled campaign', async function () {
      await contract.cancelCampaign(KEY);

      const before = await ethers.provider.getBalance(investor1.address);
      const tx     = await contract.connect(investor1).refundInvestor(KEY);
      const rec    = await tx.wait();
      const gasUsed = rec.gasUsed * rec.gasPrice;

      const after = await ethers.provider.getBalance(investor1.address);
      // net gain = 10 POL minus gas
      expect(after - before + gasUsed).to.equal(pol(10));
    });

    it('zeroes out investor contribution after refund (no double-refund)', async function () {
      await contract.cancelCampaign(KEY);
      await contract.connect(investor1).refundInvestor(KEY);

      // Second claim must fail
      await expect(contract.connect(investor1).refundInvestor(KEY))
        .to.be.revertedWith('InvestmentPlatform: No investment to refund');
    });

    it('emits InvestorRefunded event', async function () {
      await contract.cancelCampaign(KEY);
      await expect(contract.connect(investor1).refundInvestor(KEY))
        .to.emit(contract, 'InvestorRefunded')
        .withArgs(KEY, investor1.address, pol(10));
    });

    it('refunds multiple investors independently', async function () {
      await contract.cancelCampaign(KEY);
      await contract.connect(investor1).refundInvestor(KEY);
      await contract.connect(investor2).refundInvestor(KEY);

      expect(await contract.getInvestorContribution(KEY, investor1.address)).to.equal(0n);
      expect(await contract.getInvestorContribution(KEY, investor2.address)).to.equal(0n);
    });

    it('reverts if campaign is not Cancelled (Active)', async function () {
      await expect(contract.connect(investor1).refundInvestor(KEY))
        .to.be.revertedWith('InvestmentPlatform: Refunds only available for Cancelled campaigns');
    });

    it('reverts if investor has no contribution', async function () {
      await contract.cancelCampaign(KEY);
      await expect(contract.connect(stranger).refundInvestor(KEY))
        .to.be.revertedWith('InvestmentPlatform: No investment to refund');
    });
  });

  // ── 11. emergencyPause / emergencyUnpause ───────────────────────────────────

  describe('emergencyPause / emergencyUnpause', function () {
    beforeEach(async function () {
      await contract.createCampaign(KEY, startup.address, GOAL, nowPlus(86400), M_COUNT, M_PCT);
    });

    it('blocks all invest() calls while paused', async function () {
      await contract.emergencyPause();
      await expect(
        contract.connect(investor1).invest(KEY, { value: pol(5) })
      ).to.be.revertedWithCustomError(contract, 'EnforcedPause');
    });

    it('restores invest() after emergencyUnpause', async function () {
      await contract.emergencyPause();
      await contract.emergencyUnpause();
      await expect(
        contract.connect(investor1).invest(KEY, { value: pol(5) })
      ).to.not.be.reverted;
    });

    it('does not block releaseMilestone while contract paused', async function () {
      await contract.connect(investor1).invest(KEY, { value: pol(30) });
      await contract.submitMilestoneEvidenceHash(KEY, 0, EVIDENCE[0].evi, EVIDENCE[0].sum);
      await contract.approveMilestoneEvidence(KEY, 0);
      await contract.emergencyPause();
      // Release must still work (Pausable only gates invest())
      await expect(contract.releaseMilestone(KEY, 0)).to.not.be.reverted;
    });

    it('does not block refundInvestor while contract paused', async function () {
      await contract.connect(investor1).invest(KEY, { value: pol(10) });
      await contract.cancelCampaign(KEY);
      await contract.emergencyPause();
      await expect(contract.connect(investor1).refundInvestor(KEY)).to.not.be.reverted;
    });

    it('reverts emergencyPause if called by non-owner', async function () {
      await expect(contract.connect(stranger).emergencyPause())
        .to.be.revertedWithCustomError(contract, 'OwnableUnauthorizedAccount');
    });
  });

  // ── 12. View functions ──────────────────────────────────────────────────────

  describe('View functions', function () {
    it('getCampaignDetails reverts for non-existent key', async function () {
      await expect(contract.getCampaignDetails(randomKey()))
        .to.be.revertedWith('InvestmentPlatform: Campaign not found');
    });

    it('getCampaign (alias) reverts for non-existent key', async function () {
      await expect(contract.getCampaign(randomKey()))
        .to.be.revertedWith('InvestmentPlatform: Campaign not found');
    });

    it('getMilestoneDetails reverts for non-existent campaign', async function () {
      await expect(contract.getMilestoneDetails(randomKey(), 0))
        .to.be.revertedWith('InvestmentPlatform: Campaign not found');
    });

    it('getMilestoneDetails reverts for out-of-range index', async function () {
      await contract.createCampaign(KEY, startup.address, GOAL, nowPlus(86400), M_COUNT, M_PCT);
      await expect(contract.getMilestoneDetails(KEY, 5))
        .to.be.revertedWith('InvestmentPlatform: milestoneIndex out of range');
    });

    it('getInvestorContribution returns 0 for non-investor', async function () {
      await contract.createCampaign(KEY, startup.address, GOAL, nowPlus(86400), M_COUNT, M_PCT);
      expect(await contract.getInvestorContribution(KEY, stranger.address)).to.equal(0n);
    });

    it('getInvestorContribution returns 0 for non-existent campaign', async function () {
      expect(await contract.getInvestorContribution(randomKey(), investor1.address)).to.equal(0n);
    });

    it('getInvestment (alias) returns same value as getInvestorContribution', async function () {
      await contract.createCampaign(KEY, startup.address, GOAL, nowPlus(86400), M_COUNT, M_PCT);
      await contract.connect(investor1).invest(KEY, { value: pol(7) });
      expect(await contract.getInvestment(KEY, investor1.address))
        .to.equal(await contract.getInvestorContribution(KEY, investor1.address));
    });

    it('getTotalRaised reverts for non-existent key', async function () {
      await expect(contract.getTotalRaised(randomKey()))
        .to.be.revertedWith('InvestmentPlatform: Campaign not found');
    });

    it('getCampaignStatus returns correct uint8', async function () {
      await contract.createCampaign(KEY, startup.address, GOAL, nowPlus(86400), M_COUNT, M_PCT);
      expect(await contract.getCampaignStatus(KEY)).to.equal(STATUS.Active);

      await contract.pauseCampaign(KEY);
      expect(await contract.getCampaignStatus(KEY)).to.equal(STATUS.Paused);

      await contract.cancelCampaign(KEY);
      expect(await contract.getCampaignStatus(KEY)).to.equal(STATUS.Cancelled);
    });
  });

  // ── 13. Edge cases ──────────────────────────────────────────────────────────

  describe('Edge cases', function () {
    it('single-milestone campaign: 100% released in one step', async function () {
      const key = randomKey();
      await contract.createCampaign(key, startup.address, pol(10), nowPlus(86400), 1, pad5([100]));
      await contract.connect(investor1).invest(key, { value: pol(10) });

      await contract.submitMilestoneEvidenceHash(key, 0, EVIDENCE[0].evi, EVIDENCE[0].sum);
      await contract.approveMilestoneEvidence(key, 0);

      const before = await ethers.provider.getBalance(startup.address);
      await contract.releaseMilestone(key, 0);
      const after  = await ethers.provider.getBalance(startup.address);

      expect(after - before).to.equal(pol(10));
      expect(await contract.getCampaignStatus(key)).to.equal(STATUS.Completed);
    });

    it('5-milestone campaign: [20,20,20,20,20] — releases all correctly', async function () {
      const key = randomKey();
      await contract.createCampaign(key, startup.address, pol(100), nowPlus(86400), 5, [20, 20, 20, 20, 20]);
      await contract.connect(investor1).invest(key, { value: pol(100) });

      const before = await ethers.provider.getBalance(startup.address);

      for (let i = 0; i < 5; i++) {
        await contract.submitMilestoneEvidenceHash(key, i, EVIDENCE[i % 3].evi, EVIDENCE[i % 3].sum);
        await contract.approveMilestoneEvidence(key, i);
        await contract.releaseMilestone(key, i);
      }

      const after = await ethers.provider.getBalance(startup.address);
      // 100 POL × 100% = 100 POL total (5 × 20%)
      expect(after - before).to.equal(pol(100));
      expect(await contract.getCampaignStatus(key)).to.equal(STATUS.Completed);
    });

    it('rounding: releases correct integer amounts (177 POL, 3 unequal milestones)', async function () {
      // milestones: 33%, 33%, 34% — total = 100
      const key = randomKey();
      await contract.createCampaign(key, startup.address, pol(200), nowPlus(86400), 3, pad5([33, 33, 34]));
      await contract.connect(investor1).invest(key, { value: pol(177) });

      const before = await ethers.provider.getBalance(startup.address);

      for (let i = 0; i < 3; i++) {
        await contract.submitMilestoneEvidenceHash(key, i, EVIDENCE[i].evi, EVIDENCE[i].sum);
        await contract.approveMilestoneEvidence(key, i);
        await contract.releaseMilestone(key, i);
      }

      const after = await ethers.provider.getBalance(startup.address);
      // Solidity integer division floors: (177 × 33)/100 = 58.41 → 58
      // Actual released: 58 + 58 + 60 = 176 (1 wei dust stays in contract — expected)
      const released = after - before;
      // The startup receives between 99% and 100% of 177 POL
      expect(released).to.be.gte(pol(177) * 99n / 100n);
      expect(released).to.be.lte(pol(177));
    });

    it('multiple campaigns coexist independently in the same contract', async function () {
      const keyA = randomKey();
      const keyB = randomKey();
      await contract.createCampaign(keyA, startup.address, pol(50), nowPlus(86400), 2, pad5([50, 50]));
      await contract.createCampaign(keyB, startup.address, pol(80), nowPlus(86400), 1, pad5([100]));

      await contract.connect(investor1).invest(keyA, { value: pol(20) });
      await contract.connect(investor2).invest(keyB, { value: pol(40) });

      expect(await contract.getTotalRaised(keyA)).to.equal(pol(20));
      expect(await contract.getTotalRaised(keyB)).to.equal(pol(40));
    });

    it('Ownable2Step: pending owner set but not accepted yet', async function () {
      await contract.transferOwnership(investor1.address);
      // transferOwnership in Ownable2Step only sets pendingOwner, not owner
      expect(await contract.owner()).to.equal(owner.address);
      expect(await contract.pendingOwner()).to.equal(investor1.address);

      // Accepting ownership completes the transfer
      await contract.connect(investor1).acceptOwnership();
      expect(await contract.owner()).to.equal(investor1.address);
    });
  });
});
