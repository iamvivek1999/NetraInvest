/**
 * Credibility score (0–100) — heuristic combining KYB, profile depth,
 * self-reported risk, on-chain registration, milestone execution, and
 * planned fund allocation. Exposed to investors for informed discovery.
 *
 * Not financial advice; weights are documented in breakdown for transparency.
 */

/**
 * When Mongoose lean() omits StartupProfile virtuals, approximate completeness.
 * @param {object} profile
 * @returns {number} 0–100
 */
function estimateProfileCompleteness(profile) {
  if (!profile || typeof profile !== 'object') return 40;
  let n = 0;
  const checks = [
    () => !!profile.startupName,
    () => !!profile.tagline,
    () => !!profile.industry,
    () => profile.isVerified === true,
    () => !!(profile.socialLinks && (profile.socialLinks.linkedin || profile.socialLinks.twitter)),
    () => !!profile.website,
    () => Array.isArray(profile.teamMembers) && profile.teamMembers.length > 0,
  ];
  checks.forEach((fn) => {
    if (fn()) n += 1;
  });
  return Math.min(100, Math.round((n / checks.length) * 100));
}

/**
 * @param {object} campaign — plain object or Mongoose doc (lean)
 * @param {object|null} profile — populated startupProfileId or {}
 * @returns {{ score: number, breakdown: object }}
 */
function computeCredibilityScore(campaign, profile = {}) {
  const risk = Math.min(10, Math.max(1, Number(campaign.riskScore) || 5));
  /** Lower disclosed risk → higher score (max 25) */
  const riskInverted = Math.round(((11 - risk) / 10) * 25);

  const verifiedPts = profile.isVerified ? 20 : 6;

  const pcRaw = profile.profileCompleteness;
  const pc = Number.isFinite(Number(pcRaw))
    ? Number(pcRaw)
    : estimateProfileCompleteness(profile);
  const completenessPts = Math.round((Math.min(100, Math.max(0, pc)) / 100) * 15);

  let chainPts = 0;
  const oc = campaign.onChainStatus;
  if (['active', 'paused', 'funded', 'completed'].includes(oc)) {
    chainPts = 15;
  } else if (campaign.localStatus === 'approved') {
    chainPts = 5;
  }

  const mc = Math.max(1, Number(campaign.milestoneCount) || 1);
  const idx = Math.min(Number(campaign.currentMilestoneIndex) || 0, mc);
  const executionPts = Math.round((idx / mc) * 15);

  const uof = Array.isArray(campaign.useOfFunds) ? campaign.useOfFunds : [];
  let allocationPts = 0;
  if (uof.length > 0) {
    const sumPct = uof.reduce((s, x) => s + (Number(x.percentage) || 0), 0);
    allocationPts = sumPct >= 95 && sumPct <= 105 ? 10 : 6;
  }

  let score =
    riskInverted +
    verifiedPts +
    completenessPts +
    chainPts +
    executionPts +
    allocationPts;
  score = Math.min(100, Math.max(0, score));

  return {
    score,
    breakdown: {
      riskInverted,
      verifiedPts,
      completenessPts,
      chainPts,
      executionPts,
      allocationPts,
      weightsNote:
        '25 risk + 20 KYB + 15 profile + 15 chain + 15 milestones + 10 allocation (capped at 100)',
    },
  };
}

/**
 * Mutates plain campaign object: adds credibilityScore, credibilityBreakdown, displayStatus.
 * @param {object} campaign — lean plain object with optional startupProfileId populated
 */
function enrichCampaignForClient(campaign) {
  if (!campaign || typeof campaign !== 'object') return campaign;

  const profile =
    campaign.startupProfileId &&
    typeof campaign.startupProfileId === 'object' &&
    !Array.isArray(campaign.startupProfileId)
      ? campaign.startupProfileId
      : {};

  const { score, breakdown } = computeCredibilityScore(campaign, profile);
  campaign.credibilityScore = score;
  campaign.credibilityBreakdown = breakdown;

  /** Single field for list/detail badges */
  if (campaign.onChainStatus && campaign.onChainStatus !== 'unregistered') {
    campaign.displayStatus = campaign.onChainStatus;
  } else {
    campaign.displayStatus = campaign.localStatus || 'unknown';
  }
  /** Alias used by older frontend code */
  campaign.status = campaign.displayStatus;

  /** Mirrors legacy field — true once registered on-chain */
  campaign.isContractDeployed =
    !!campaign.campaignKey &&
    !!campaign.contractAddress &&
    ['active', 'paused', 'funded', 'completed'].includes(campaign.onChainStatus);

  return campaign;
}

module.exports = {
  computeCredibilityScore,
  enrichCampaignForClient,
  estimateProfileCompleteness,
};
