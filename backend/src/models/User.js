/**
 * src/models/User.js
 *
 * User model — shared by all roles (investor, startup, admin).
 * Role differentiates behavior throughout the system.
 *
 * Security:
 *  - passwordHash is excluded from all queries by default (select: false)
 *  - comparePassword runs bcrypt.compare, never exposes raw hash
 *  - walletAddress uses a sparse unique index (nulls are excluded)
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 12;

const userSchema = new mongoose.Schema(
  {
    // ── Identity ────────────────────────────────────────────────────────────
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      maxlength: [80, 'Full name cannot exceed 80 characters'],
    },

    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,10})+$/,
        'Please provide a valid email address',
      ],
    },

    // select: false — NEVER returned in queries unless explicitly requested
    passwordHash: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
    },

    // ── Role ────────────────────────────────────────────────────────────────
    role: {
      type: String,
      enum: {
        values: ['investor', 'startup', 'admin'],
        message: 'Role must be one of: investor, startup, admin',
      },
      required: [true, 'Role is required'],
      // Role is intentionally NOT immutable here so admin seeding works cleanly.
      // Application logic enforces that users cannot change their own role.
    },

    // ── Blockchain ──────────────────────────────────────────────────────────
    walletAddress: {
      type: String,
      match: [
        /^0x[a-fA-F0-9]{40}$/,
        'Invalid Ethereum wallet address format',
      ],
      // Validated by partial unique index below structure
    },

    // ── Status ──────────────────────────────────────────────────────────────
    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    isActive: {
      type: Boolean,
      default: true,
      // soft-delete: set to false instead of deleting the document
    },

    // ── Optional Contact ────────────────────────────────────────────────────
    phone: {
      type: String,
      default: null,
      match: [/^\+?[1-9]\d{6,14}$/, 'Invalid phone number format'],
    },

    profileImage: {
      type: String,
      default: null,
    },

    // ── Session Tracking ────────────────────────────────────────────────────
    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true, // adds createdAt, updatedAt automatically
    toJSON: {
      transform(doc, ret) {
        // Strip sensitive and internal fields from JSON output
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
// Note: email unique index is already created by { unique: true } in the schema field definition.
// We only declare explicit indexes here for fields that need sparse or compound behavior.

// partialFilterExpression — fully allows multiple null or absent fields while enforcing uniqueness for actual values
userSchema.index(
  { walletAddress: 1 },
  { unique: true, partialFilterExpression: { walletAddress: { $type: 'string' } } }
);

userSchema.index({ role: 1 });

// ─── Pre-Save Hook: Hash Password ─────────────────────────────────────────────
// Runs only if passwordHash was modified (prevents re-hashing on other updates)

userSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) return next();
  this.passwordHash = await bcrypt.hash(this.passwordHash, SALT_ROUNDS);
  next();
});

// ─── Instance Method: Compare Password ───────────────────────────────────────
// Used during login — accepts plain-text password, returns boolean

userSchema.methods.comparePassword = async function (plainTextPassword) {
  return bcrypt.compare(plainTextPassword, this.passwordHash);
};

// ─── Instance Method: Get Public Profile ─────────────────────────────────────
// Returns a safe, serializable user object (no hash, no internal fields)

userSchema.methods.toPublicProfile = function () {
  return {
    _id: this._id,
    fullName: this.fullName,
    email: this.email,
    role: this.role,
    walletAddress: this.walletAddress,
    isEmailVerified: this.isEmailVerified,
    profileImage: this.profileImage,
    createdAt: this.createdAt,
  };
};

const User = mongoose.model('User', userSchema);

module.exports = User;
