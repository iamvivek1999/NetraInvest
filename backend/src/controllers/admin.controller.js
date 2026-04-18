const StartupProfile = require('../models/StartupProfile');
const InvestorProfile = require('../models/InvestorProfile');
const User = require('../models/User');
const Campaign = require('../models/Campaign');
const Investment = require('../models/Investment');
const { ApiError } = require('../middleware/errorHandler');

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
      { $group: { _id: '$status', count: { $sum: 1 } } }
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
    .limit(limit);

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

  res.status(200).json({
    success: true,
    message: `${role} verification status updated to ${status}`,
    data: profile,
  });
};
