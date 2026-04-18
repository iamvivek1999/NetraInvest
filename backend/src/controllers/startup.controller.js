/**
 * src/controllers/startup.controller.js
 *
 * Handles all startup profile CRUD operations.
 *
 * Access control summary:
 *   createProfile   → startup role only, one per user
 *   updateProfile   → startup role only, own profile only
 *   getMyProfile    → startup role only
 *   getProfile      → any authenticated user (investor + startup)
 *   getAllProfiles   → any authenticated user, with filters + pagination
 */

const StartupProfile = require('../models/StartupProfile');
const sendResponse = require('../utils/sendResponse');
const { ApiError } = require('../middleware/errorHandler');
const { getStartupAccessState } = require('../services/startup.service');

// ─── Helper: build safe update object ────────────────────────────────────────
/**
 * Picks only updatable fields from req.body.
 * Prevents clients from injecting userId, isVerified, or other protected fields.
 */
const UPDATABLE_FIELDS = [
  // Core identity
  'startupName', 'legalCompanyName', 'companyLogo', 'tagline', 'description',
  'pitchSummary', 'problemStatement', 'solutionDescription', 'targetMarket', 'tractionSummary',
  // Categorization
  'industry', 'tags', 'fundingStage',
  // Business details
  'website', 'location', 'foundedYear', 'teamSize', 'teamMembers', 'documents', 'socialLinks',
  // Registration
  'legalEntityType', 'mcaRegistrationNumber', 'panNumber', 'incorporationDate', 'registrationType',
  // Financials + documents
  'financialData', 'kycDocuments', 'businessVerificationDocuments',
];

// Statuses that allow editing
const EDITABLE_STATUSES = ['draft', 'rejected', 'more_info_required'];

const pickUpdateFields = (body) => {
  return UPDATABLE_FIELDS.reduce((acc, field) => {
    if (body[field] !== undefined) acc[field] = body[field];
    return acc;
  }, {});
};

// ─── Create Profile ───────────────────────────────────────────────────────────

/**
 * POST /api/v1/startups
 * Role: startup only
 *
 * Creates a startup profile for the authenticated startup user.
 * One profile per startup user — enforced by unique index on userId.
 */
const createProfile = async (req, res) => {
  const { userId } = req.user;

  // Enforce one profile per startup user
  const existingProfile = await StartupProfile.findOne({ userId });
  if (existingProfile) {
    throw new ApiError(
      'You already have a startup profile. Use the update endpoint to modify it.',
      409
    );
  }

  const profileData = pickUpdateFields(req.body);
  profileData.userId = userId;

  const profile = await StartupProfile.create(profileData);

  // Populate user details for the response
  const populated = await StartupProfile.findById(profile._id).populate(
    'userId', 'fullName email'
  );

  sendResponse(res, 201, 'Startup profile created successfully', { profile: populated });
};

// ─── Update Profile ───────────────────────────────────────────────────────────

/**
 * PATCH /api/v1/startups/:id
 * Role: startup only, own profile only
 *
 * Partial update — only provided fields are updated.
 * Uses runValidators: true to enforce schema constraints on update.
 */
const updateProfile = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.user;

  // Find the profile
  const profile = await StartupProfile.findById(id);
  if (!profile) {
    throw new ApiError('Startup profile not found.', 404);
  }

  // Ownership check — startup can only update their own profile
  if (profile.userId.toString() !== userId) {
    throw new ApiError('You are not authorized to update this profile.', 403);
  }

  // Check edit lock — cannot edit once submitted/pending/in_review/approved
  if (!EDITABLE_STATUSES.includes(profile.verificationStatus)) {
    throw new ApiError(
      `Profile cannot be edited when status is '${profile.verificationStatus}'. Contact support to reopen.`,
      403
    );
  }

  const updates = pickUpdateFields(req.body);

  if (Object.keys(updates).length === 0) {
    throw new ApiError('No valid fields provided for update.', 400);
  }

  const updated = await StartupProfile.findByIdAndUpdate(
    id,
    { $set: updates },
    { new: true, runValidators: true }
  ).populate('userId', 'fullName email');

  sendResponse(res, 200, 'Startup profile updated successfully', { profile: updated });
};

// ─── Get My Profile ───────────────────────────────────────────────────────────

/**
 * GET /api/v1/startups/me
 * Role: startup only
 *
 * Returns the startup profile for the currently authenticated startup user.
 * Used by the startup dashboard to load its own profile.
 */
const getMyProfile = async (req, res) => {
  const { userId } = req.user;

  const profile = await StartupProfile.findOne({ userId }).populate(
    'userId', 'fullName email phone walletAddress'
  );

  if (!profile) {
    throw new ApiError(
      'You do not have a startup profile yet. Please create one first.',
      404
    );
  }

  sendResponse(res, 200, 'Startup profile retrieved', { profile });
};

// ─── Get Single Profile ───────────────────────────────────────────────────────

/**
 * GET /api/v1/startups/:id
 * Role: any authenticated user (investor + startup)
 *
 * Returns the full public startup profile by profile _id.
 * Does NOT expose userId's sensitive auth fields.
 */
const getProfile = async (req, res) => {
  const { id } = req.params;

  const profile = await StartupProfile.findById(id).populate(
    'userId', 'fullName email'
  );

  if (!profile) {
    throw new ApiError('Startup profile not found.', 404);
  }

  sendResponse(res, 200, 'Startup profile retrieved', { profile });
};

// ─── Get All Profiles ─────────────────────────────────────────────────────────

/**
 * GET /api/v1/startups
 * Role: any authenticated user
 *
 * Supports filters, text search, and pagination.
 *
 * Query params:
 *   industry      → filter by industry (e.g. ?industry=fintech)
 *   fundingStage  → filter by stage (e.g. ?fundingStage=seed)
 *   isVerified    → filter to verified only (e.g. ?isVerified=true)
 *   search        → text search on name + description + tags
 *   page          → page number (default: 1)
 *   limit         → results per page (default: 12, max: 50)
 *   sortBy        → 'newest' | 'completeness' (default: 'newest')
 */
const getAllProfiles = async (req, res) => {
  const {
    industry,
    fundingStage,
    isVerified,
    search,
    page = 1,
    limit = 12,
    sortBy = 'newest',
  } = req.query;

  // Build filter object
  const filter = {};

  if (industry)     filter.industry     = industry;
  if (fundingStage) filter.fundingStage = fundingStage;
  if (isVerified === 'true')  filter.isVerified = true;
  if (isVerified === 'false') filter.isVerified = false;

  // Text search (uses the compound text index on startupName + description + tags)
  if (search) {
    filter.$text = { $search: search };
  }

  // Pagination
  const pageNum  = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 12));
  const skip     = (pageNum - 1) * limitNum;

  // Sorting
  let sort = {};
  if (sortBy === 'newest') {
    sort = { createdAt: -1 };
  } else if (sortBy === 'completeness') {
    // profileCompleteness is a virtual — cannot sort by it in MongoDB.
    // Sort by document count as a proxy for completeness (practical for MVP)
    sort = { 'documents.0': -1, createdAt: -1 };
  }

  // Run query and count in parallel
  const [profiles, total] = await Promise.all([
    StartupProfile.find(filter)
      .populate('userId', 'fullName email')
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .lean({ virtuals: true }), // include virtuals in lean() output
    StartupProfile.countDocuments(filter),
  ]);

  sendResponse(
    res,
    200,
    'Startup profiles retrieved',
    { profiles },
    {
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum),
      },
    }
  );
};

// ─── Submit Profile ──────────────────────────────────────────────────────────────

/**
 * POST /api/v1/startups/submit
 * Role: startup only
 *
 * Transitions the startup's profile from 'draft' (or 'rejected' resubmission)
 * to 'submitted', then sets it to 'pending' for admin review.
 *
 * Business rules:
 *   - Profile must exist
 *   - Must be in EDITABLE_STATUSES (draft / rejected / more_info_required)
 *   - Required fields checked before allowing submission
 */
const submitProfile = async (req, res) => {
  const { userId } = req.user;

  const profile = await StartupProfile.findOne({ userId });
  if (!profile) {
    throw new ApiError('No startup profile found. Please create one first.', 404);
  }

  if (!EDITABLE_STATUSES.includes(profile.verificationStatus)) {
    throw new ApiError(
      `Cannot submit: profile is currently '${profile.verificationStatus}'.`,
      409
    );
  }

  // Validate minimum required fields for submission
  const missing = [];
  if (!profile.startupName?.trim())    missing.push('Startup name');
  if (!profile.description?.trim())    missing.push('Description (min 50 chars)');
  if (!profile.industry)               missing.push('Industry');
  if (!profile.teamMembers?.length)    missing.push('At least one team member');

  if (missing.length > 0) {
    throw new ApiError(
      `Cannot submit — the following required fields are missing: ${missing.join(', ')}.`,
      422
    );
  }

  const updated = await StartupProfile.findByIdAndUpdate(
    profile._id,
    {
      $set: {
        verificationStatus: 'pending',
        submittedAt:        new Date(),
        rejectionReason:    null, // clear previous rejection reason on resubmit
      },
    },
    { new: true }
  ).populate('userId', 'fullName email');

  sendResponse(res, 200, 'Profile submitted for verification. We will review it within 24–48 hours.', { profile: updated });
};

// ─── Verification Status ──────────────────────────────────────────────────────
/**
 * GET /api/v1/startups/verification-status
 * 
 * Returns the current verification state for the logged-in startup.
 */
const getVerificationStatus = async (req, res, next) => {
  try {
    const accessState = await getStartupAccessState(req.user.userId);
    sendResponse(res, 200, 'Verification status fetched', accessState);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createProfile,
  updateProfile,
  getMyProfile,
  getProfile,
  getAllProfiles,
  submitProfile,
  getVerificationStatus,
};
