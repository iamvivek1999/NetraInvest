/**
 * src/controllers/auth.controller.js
 *
 * Auth controller — handles register, login, getMe, and wallet-link.
 *
 * All handlers are async. express-async-errors ensures unhandled
 * promise rejections are forwarded to errorHandler.js automatically.
 *
 * Response shape (auth endpoints):
 * {
 *   success: true,
 *   message: "...",
 *   token: "<jwt>",
 *   data: { user: { ... } }
 * }
 */

const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const sendResponse = require('../utils/sendResponse');
const { ApiError } = require('../middleware/errorHandler');

// ─── Register ─────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/auth/register
 *
 * Creates a new user account (investor or startup only).
 * Admin accounts are seeded separately — not via this endpoint.
 *
 * Body: { fullName, email, password, role }
 */
const register = async (req, res) => {
  const { fullName, email, password, role } = req.body;

  // Prevent admin registration through public endpoint
  if (role === 'admin') {
    throw new ApiError('Admin accounts cannot be created through this endpoint.', 403);
  }

  // Check if email is already registered
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new ApiError('An account with this email address already exists.', 409);
  }

  // Create user — password is stored in passwordHash field
  // Pre-save hook in User.js will hash it before writing to DB
  const user = await User.create({
    fullName,
    email,
    passwordHash: password, // raw password → pre-save hook hashes it
    role,
  });

  // Issue JWT
  const token = generateToken(user);

  // Update lastLoginAt on registration (first login)
  user.lastLoginAt = new Date();
  await user.save({ validateBeforeSave: false });

  sendResponse(res, 201, 'Account created successfully', { user: user.toPublicProfile() }, { token });
};

// ─── Login ────────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/auth/login
 *
 * Authenticates an existing user.
 * Returns JWT on success.
 *
 * Body: { email, password }
 */
const login = async (req, res) => {
  const { email, password, role } = req.body;

  // Fetch user WITH passwordHash (excluded by default via select: false)
  const user = await User.findOne({ email }).select('+passwordHash');

  // Generic error — do NOT reveal whether the email exists or not
  if (!user) {
    throw new ApiError('Invalid email or password.', 401);
  }

  // Check account is active
  if (!user.isActive) {
    throw new ApiError('Your account has been deactivated. Please contact support.', 401);
  }

  // Compare plain-text password against stored hash
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new ApiError('Invalid email or password.', 401);
  }

  // Role verification — if the frontend sends a role, it MUST match the stored role.
  // This prevents a startup user from logging in via the investor flow and vice-versa.
  // Backend is the single source of truth; the frontend role param is merely a hint.
  if (role && user.role !== role) {
    throw new ApiError(
      `This account is registered as a ${user.role}. Please use the ${user.role} login.`,
      403
    );
  }

  // Update last login timestamp
  user.lastLoginAt = new Date();
  await user.save({ validateBeforeSave: false });

  // Issue JWT
  const token = generateToken(user);

  sendResponse(res, 200, 'Login successful', { user: user.toPublicProfile() }, { token });
};

// ─── Get Me ───────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/auth/me
 * Protected route — requires valid JWT.
 *
 * Returns the currently authenticated user's profile.
 * Useful for the frontend to restore session state after page refresh.
 */
const getMe = async (req, res) => {
  // req.user.userId is set by protect middleware
  const user = await User.findById(req.user.userId);

  if (!user) {
    throw new ApiError('User not found.', 404);
  }

  sendResponse(res, 200, 'User profile retrieved', { user: user.toPublicProfile() });
};

// ─── Link Wallet ──────────────────────────────────────────────────────────────

/**
 * PATCH /api/v1/auth/wallet
 * Protected route — requires valid JWT.
 *
 * Links an Ethereum wallet address to the authenticated user's account.
 * Required for investors before they can invest on-chain.
 *
 * Body: { walletAddress }
 */
const linkWallet = async (req, res) => {
  const { walletAddress } = req.body;

  // Check if wallet is already in use by another account
  const existingWallet = await User.findOne({
    walletAddress,
    _id: { $ne: req.user.userId }, // exclude current user
  });

  if (existingWallet) {
    throw new ApiError('This wallet address is already linked to another account.', 409);
  }

  const user = await User.findByIdAndUpdate(
    req.user.userId,
    { walletAddress },
    { new: true, runValidators: true }
  );

  if (!user) {
    throw new ApiError('User not found.', 404);
  }

  sendResponse(res, 200, 'Wallet address linked successfully', { user: user.toPublicProfile() });
};

// ─── Logout ───────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/auth/logout
 * Protected route — requires valid JWT.
 *
 * JWT is stateless — actual token invalidation happens client-side.
 * This endpoint provides a clean API contract and can be extended with
 * a token blacklist (Redis) in the future for stricter security.
 *
 * The frontend should clear localStorage['enigma-auth'] on receipt.
 */
const logout = async (req, res) => {
  // No server-side state to clear for stateless JWT.
  // Future: add token to a Redis blacklist here.
  sendResponse(res, 200, 'Logged out successfully. Please clear your local session.', {});
};

module.exports = { register, login, getMe, linkWallet, logout };
