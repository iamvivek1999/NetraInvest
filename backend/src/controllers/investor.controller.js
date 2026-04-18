/**
 * src/controllers/investor.controller.js
 *
 * Investor profile CRUD operations.
 *
 * Access control:
 *   createProfile  → investor role only, one per user
 *   updateProfile  → investor role only, own profile only
 *   getMyProfile   → investor role only → returns InvestorProfile + User data + investment summary
 *   getProfile     → any authenticated user (startup can view investor profile)
 */

const InvestorProfile = require('../models/InvestorProfile');
const Investment = require('../models/Investment');
const sendResponse = require('../utils/sendResponse');
const { ApiError } = require('../middleware/errorHandler');

// ─── Updatable Fields ─────────────────────────────────────────────────────────
const UPDATABLE_FIELDS = [
  'firstName', 'lastName', 'bio',
  'linkedInUrl', 'twitterUrl',
  'preferredStages', 'preferredIndustries',
];

const pickUpdateFields = (body) =>
  UPDATABLE_FIELDS.reduce((acc, field) => {
    if (body[field] !== undefined) acc[field] = body[field];
    return acc;
  }, {});

// ─── Create Investor Profile ──────────────────────────────────────────────────

/**
 * POST /api/v1/investors
 * Role: investor only
 */
const createProfile = async (req, res) => {
  const { userId } = req.user;

  const existing = await InvestorProfile.findOne({ userId });
  if (existing) {
    throw new ApiError(
      'You already have an investor profile. Use PATCH to update it.',
      409
    );
  }

  const profileData = pickUpdateFields(req.body);
  profileData.userId = userId;

  const profile = await InvestorProfile.create(profileData);

  const populated = await InvestorProfile.findById(profile._id)
    .populate('userId', 'fullName email');

  sendResponse(res, 201, 'Investor profile created successfully', { profile: populated });
};

// ─── Get My Profile ───────────────────────────────────────────────────────────

/**
 * GET /api/v1/investors/me
 * Role: investor only
 *
 * Returns the full investor profile with investment summary for the dashboard.
 */
const getMyProfile = async (req, res) => {
  const { userId } = req.user;

  const [profile, summaryAgg] = await Promise.all([
    InvestorProfile.findOne({ userId }).populate('userId', 'fullName email'),
    Investment.aggregate([
      { $match: { investorUserId: userId, status: { $in: ['confirmed', 'unverified'] } } },
      {
        $group: {
          _id: null,
          totalInvested: { $sum: '$amount' },
          campaignCount:  { $addToSet: '$campaignId' },
        },
      },
      { $project: { totalInvested: 1, campaignCount: { $size: '$campaignCount' } } },
    ]),
  ]);

  if (!profile) {
    // Return a blank profile stub so mobile can still render the dashboard
    const user = await require('../models/User').findById(userId).select('fullName email');
    return sendResponse(res, 200, 'No investor profile yet', {
      profile: null,
      user: user ? { fullName: user.fullName, email: user.email } : null,
      investmentSummary: { totalInvested: 0, campaignCount: 0 },
    });
  }

  const summary = summaryAgg[0] || { totalInvested: 0, campaignCount: 0 };

  sendResponse(res, 200, 'Investor profile retrieved', {
    profile,
    investmentSummary: summary,
  });
};

// ─── Update Profile ───────────────────────────────────────────────────────────

/**
 * PATCH /api/v1/investors/me
 * Role: investor only — updates the authenticated investor's own profile.
 */
const updateProfile = async (req, res) => {
  const { userId } = req.user;

  const updates = pickUpdateFields(req.body);

  if (Object.keys(updates).length === 0) {
    throw new ApiError('No valid fields provided for update.', 400);
  }

  const profile = await InvestorProfile.findOneAndUpdate(
    { userId },
    { $set: { ...updates, updatedAt: new Date() } },
    { new: true, runValidators: true, upsert: false }
  ).populate('userId', 'fullName email');

  if (!profile) {
    throw new ApiError(
      'You do not have an investor profile yet. Create one first via POST /api/v1/investors.',
      404
    );
  }

  sendResponse(res, 200, 'Investor profile updated successfully', { profile });
};

// ─── Get Single Profile (public) ─────────────────────────────────────────────

/**
 * GET /api/v1/investors/:id
 * Role: any authenticated user
 */
const getProfile = async (req, res) => {
  const profile = await InvestorProfile.findById(req.params.id)
    .populate('userId', 'fullName');

  if (!profile) {
    throw new ApiError('Investor profile not found.', 404);
  }

  sendResponse(res, 200, 'Investor profile retrieved', { profile });
};

module.exports = {
  createProfile,
  getMyProfile,
  updateProfile,
  getProfile,
};
