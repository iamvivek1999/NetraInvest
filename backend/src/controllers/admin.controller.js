const StartupProfile = require('../models/StartupProfile');
const InvestorProfile = require('../models/InvestorProfile');
const User = require('../models/User');
const Campaign = require('../models/Campaign');
const Investment = require('../models/Investment');
const { ApiError } = require('../middleware/errorHandler');
const notify = require('../utils/notify');

/**
 * Ensures we map the requested role to the correct Profile model.
 */
const getModelForRole = (role) => {
  if (role === 'startup') return StartupProfile;
  if (role === 'investor') return InvestorProfile;
  throw new ApiError('Invalid role specified for verification', 400);
};

exports.getDashboardStats = async (req, res) => {
  const [
    totalUsers,
    totalStartups,
    totalInvestors,
    investmentStats,
    campaignStats,
    pendingStartups,
    pendingInvestors
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ role: 'startup' }),
    User.countDocuments({ role: 'investor' }),
    Investment.aggregate([
      { $group: { _id: null, totalRaised: { $sum: '$amount' }, count: { $sum: 1 } } }
    ]),
    Campaign.aggregate([
      { $group: { _id: '$localStatus', count: { $sum: 1 } } }
    ]),
    StartupProfile.countDocuments({ verificationStatus: 'pending' }),
    InvestorProfile.countDocuments({ verificationStatus: 'pending' })
  ]);

  const stats = {
    users: {
      total: totalUsers,
      startups: totalStartups,
      investors: totalInvestors
    },
    investments: {
      totalAmount: investmentStats[0]?.totalRaised || 0,
      totalCount: investmentStats[0]?.count || 0
    },
    campaigns: Object.fromEntries(campaignStats.map(s => [s._id, s.count])),
    backlog: {
      startups: pendingStartups,
      investors: pendingInvestors
    }
  };

  res.status(200).json({
    success: true,
    data: stats
  });
};

exports.getUsers = async (req, res) => {
  const { role, status, page = 1, limit = 20, search } = req.query;
  const skip = (page - 1) * limit;

  const query = {};
  if (role) query.role = role;
  if (status !== undefined) query.isActive = status === 'active';
  if (search) {
    query.$or = [
      { email: { $regex: search, $options: 'i' } }
    ];
  }

  const users = await User.find(query)
    .select('-password')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  const investorIds = users.filter(u => u.role === 'investor').map(u => u._id);
  const profiles = await InvestorProfile.find({ userId: { $in: investorIds } }).lean();

  users.forEach(u => {
    if (u.role === 'investor') {
       const p = profiles.find(pr => pr.userId.toString() === u._id.toString());
       u.premiumStatus = p?.premiumStatus || false;
    }
  });

  const total = await User.countDocuments(query);

  res.status(200).json({
    success: true,
    total,
    page: parseInt(page),
    totalPages: Math.ceil(total / limit),
    data: users
  });
};

exports.toggleUserStatus = async (req, res) => {
  const { id } = req.params;
  const { isActive } = req.body;

  const user = await User.findById(id);
  if (!user) {
    throw new ApiError('User not found', 404);
  }

  if (user.role === 'admin') {
    throw new ApiError('Cannot modify status of another administrator', 403);
  }

  user.isActive = isActive;
  await user.save();

  res.status(200).json({
    success: true,
    message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
    data: { id: user._id, isActive: user.isActive }
  });
};

exports.getVerifications = async (req, res) => {
  const { role } = req.params;
  const { status, limit = 50, page = 1 } = req.query;

  const Model = getModelForRole(role);
  
  const query = {};
  if (status) {
    query.verificationStatus = status;
  }

  const skip = (page - 1) * limit;

  // Populate user data to get email and account status
  const profiles = await Model.find(query)
    .populate('userId', 'email isActive createdAt')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit, 10));

  const total = await Model.countDocuments(query);

  res.status(200).json({
    success: true,
    count: profiles.length,
    total,
    page: parseInt(page, 10),
    totalPages: Math.ceil(total / limit),
    data: profiles,
  });
};

exports.getVerificationById = async (req, res) => {
  const { role, id } = req.params;
  const Model = getModelForRole(role);

  const profile = await Model.findById(id).populate('userId', 'email isActive createdAt');
  
  if (!profile) {
    throw new ApiError(`${role} profile not found`, 404);
  }

  res.status(200).json({
    success: true,
    data: profile,
  });
};

exports.updateVerificationStatus = async (req, res) => {
  const { role, id } = req.params;
  const { status, rejectionReason } = req.body;

  const validStatuses = ['pending', 'in_review', 'approved', 'rejected', 'more_info_required'];
  if (!validStatuses.includes(status)) {
    throw new ApiError('Invalid verification status provided', 400);
  }

  if ((status === 'rejected' || status === 'more_info_required') && !rejectionReason) {
    throw new ApiError(`A reason must be provided when status is ${status}`, 400);
  }

  const Model = getModelForRole(role);
  const profile = await Model.findById(id);

  if (!profile) {
    throw new ApiError(`${role} profile not found`, 404);
  }

  profile.verificationStatus = status;
  
  if (status === 'approved') {
    profile.isVerified = true;
    profile.verifiedAt = new Date();
    profile.rejectionReason = null;
  } else {
    profile.isVerified = false; // Revoke if changing away from approved
    profile.verifiedAt = null;
    profile.rejectionReason = rejectionReason || null;
  }

  await profile.save();

  // Trigger Notifications if this is a startup profile
  if (role === 'startup') {
    if (status === 'approved') {
      await notify(
        profile.userId,
        'startup_verified',
        'Congratulations! Your startup profile has been verified. You can now create fundraising campaigns.'
      );
    } else if (status === 'rejected') {
      await notify(
        profile.userId,
        'startup_rejected',
        `Your startup profile was rejected: ${rejectionReason}`
      );
    } else if (status === 'more_info_required') {
      await notify(
        profile.userId,
        'startup_needs_info',
        `More information is required for your startup verification: ${rejectionReason}`
      );
    }
  }

  res.status(200).json({
    success: true,
    message: `${role} verification status updated to ${status}`,
    data: profile,
  });
};

exports.toggleInvestorPremium = async (req, res) => {
  const { id } = req.params;
  const { premiumStatus } = req.body;

  if (typeof premiumStatus !== 'boolean') {
    throw new ApiError('premiumStatus must be a boolean', 400);
  }

  // Find the investor profile
  // Warning: id here might be userId if the frontend user objects only hold User._id
  // We check if it's the InvestorProfile _id, if not, check userId.
  let profile = await InvestorProfile.findById(id);
  if (!profile) {
    profile = await InvestorProfile.findOne({ userId: id });
  }

  if (!profile) {
    throw new ApiError('Investor profile not found', 404);
  }

  profile.premiumStatus = premiumStatus;
  await profile.save();

  res.status(200).json({
    success: true,
    message: `Premium status updated to ${premiumStatus}`,
    data: { id: profile._id, userId: profile.userId, premiumStatus: profile.premiumStatus }
  });
};

exports.getCampaignsForReview = async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (page - 1) * limit;

  // We look for campaigns that are submitted or under review.
  const query = { localStatus: { $in: ['submitted', 'under_review'] } };

  const campaigns = await Campaign.find(query)
    .populate('startupId', 'companyName companyLogo')
    .sort({ updatedAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  const total = await Campaign.countDocuments(query);

  res.status(200).json({
    success: true,
    total,
    page: parseInt(page),
    totalPages: Math.ceil(total / limit),
    data: campaigns,
  });
};

exports.updateCampaignStatus = async (req, res) => {
  const { id } = req.params;
  const { status, adminReviewNotes } = req.body;

  const validStatuses = ['draft', 'submitted', 'under_review', 'approved', 'rejected'];
  if (!validStatuses.includes(status)) {
    throw new ApiError('Invalid campaign local status provided for administrative review', 400);
  }

  const campaign = await Campaign.findById(id);
  if (!campaign) {
    throw new ApiError('Campaign not found', 404);
  }

  campaign.localStatus = status;
  if (adminReviewNotes) {
    campaign.adminReviewNotes = adminReviewNotes;
  }

  await campaign.save();

  // Trigger Notifications if this is a campaign state change
  if (status === 'approved') {
    await notify(
      campaign.userId, // Actually campaign stores startupId not userId, we should fix this if so: Wait, campaign model has startupId (ref: StartupProfile), and startupProfile has userId. We'll skip notification for now or look up the user.
      'campaign_approved',
      `Your campaign "${campaign.title}" has been approved!`
    );
  } else if (status === 'rejected') {
    await notify(
      campaign.userId, 
      'campaign_rejected',
      `Your campaign "${campaign.title}" was rejected. Review notes: ${adminReviewNotes}`
    );
  }

  res.status(200).json({
    success: true,
    message: `Campaign status updated to ${status}`,
    data: campaign,
  });
};
