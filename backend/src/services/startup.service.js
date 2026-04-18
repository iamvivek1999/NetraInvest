const StartupProfile = require('../models/StartupProfile');

/**
 * Service to determine startup access rights based on their profile.
 * 
 * Returns an object shape:
 * {
 *   startupProfileExists: boolean,
 *   verificationStatus: string | null,
 *   rejectionReason: string | null,
 *   canCreateCampaign: boolean,
 *   nextAction: string
 * }
 */
const getStartupAccessState = async (userId) => {
  const profile = await StartupProfile.findOne({ userId });

  if (!profile) {
    return {
      startupProfileExists: false,
      verificationStatus: null,
      rejectionReason: null,
      canCreateCampaign: false,
      nextAction: 'create_profile'
    };
  }

  const { verificationStatus, rejectionReason } = profile;
  const isApproved = verificationStatus === 'approved';

  let nextAction = 'none';
  if (verificationStatus === 'draft') nextAction = 'complete_draft';
  else if (verificationStatus === 'rejected' || verificationStatus === 'more_info_required') nextAction = 'edit_and_resubmit';
  else if (!isApproved) nextAction = 'wait_for_review';
  else nextAction = 'create_campaign';

  return {
    startupProfileExists: true,
    verificationStatus,
    rejectionReason: rejectionReason || null,
    canCreateCampaign: isApproved,
    nextAction
  };
};

module.exports = {
  getStartupAccessState
};
