/**
 * src/models/StartupProfile.js
 *
 * Startup profile — one per startup user (enforced by unique index on userId).
 *
 * Design decisions:
 *  - profileCompleteness is a virtual (computed on read, never stored)
 *    This avoids sync drift when fields are updated.
 *  - teamMembers and documents are embedded arrays (not separate collections)
 *    for MVP simplicity. Subdocument size stays manageable for hackathon scale.
 *  - isVerified is admin-set only — never writable via public API.
 *  - toJSON: { virtuals: true } ensures profileCompleteness is included
 *    in API responses automatically.
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

// Document metadata structure (for kycDocuments + businessVerificationDocuments)
const documentMetaSchema = new Schema(
  {
    fileName:          { type: String, trim: true, default: null },
    fileType:          { type: String, trim: true, default: null }, // 'pdf', 'jpg', etc.
    fileUrl:           { type: String, trim: true, default: null }, // placeholder URL
    uploadedAt:        { type: Date,   default: Date.now },
    documentCategory:  { type: String, trim: true, default: null }, // e.g. 'identity', 'financial'
    verificationLabel: { type: String, trim: true, default: null }, // admin-visible label
  },
  { _id: true }
);

// Financial data sub-schema
const financialDataSchema = new Schema(
  {
    annualRevenue:  { type: Number, default: null },  // in INR
    monthlyRevenue: { type: Number, default: null },
    profitOrLoss:   { type: String, enum: ['profit', 'loss', 'breakeven', null], default: null },
    burnRate:       { type: Number, default: null },  // monthly burn in INR
    runwayMonths:   { type: Number, default: null },
  },
  { _id: false }
);

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

const teamMemberSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Team member name is required'],
      trim: true,
      maxlength: [80, 'Name cannot exceed 80 characters'],
    },
    role: {
      type: String,
      required: [true, 'Team member role is required'],
      trim: true,
      maxlength: [80, 'Role cannot exceed 80 characters'],
    },
    bio: {
      type: String,
      trim: true,
      maxlength: [500, 'Bio cannot exceed 500 characters'],
      default: null,
    },
    linkedIn: {
      type: String,
      default: null,
    },
    profileImage: {
      type: String,
      default: null,
    },
  },
  { _id: true } // keep subdocument IDs for targeted updates later
);

const documentSchema = new Schema(
  {
    docType: {
      type: String,
      enum: {
        values: ['mca_cert', 'pan_card', 'address_proof', 'pitch_deck', 'financials', 'legal', 'product_demo', 'other'],
        message: 'Document type must be one of: mca_cert, pan_card, address_proof, pitch_deck, financials, legal, product_demo, other',
      },
      required: [true, 'Document type is required'],
    },
    url: {
      type: String,
      required: [true, 'Document URL is required'],
      trim: true,
    },
    label: {
      type: String,
      trim: true,
      maxlength: [100, 'Label cannot exceed 100 characters'],
      default: null,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

// ─── Main Schema ──────────────────────────────────────────────────────────────

const startupProfileSchema = new Schema(
  {
    // ── Ownership ──────────────────────────────────────────────────────────
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      unique: true, // one profile per startup user
    },

    // ── Core Identity ──────────────────────────────────────────────────────
    startupName: {
      type: String,
      required: [true, 'Startup name is required'],
      trim: true,
      maxlength: [100, 'Startup name cannot exceed 100 characters'],
    },

    // Legal registered company name (may differ from brand name)
    legalCompanyName: {
      type: String,
      trim: true,
      maxlength: [200, 'Legal company name cannot exceed 200 characters'],
      default: null,
    },

    // Logo URL (CDN/object-storage URL, set after upload)
    companyLogo: {
      type: String,
      trim: true,
      default: null,
    },

    tagline: {
      type: String,
      trim: true,
      maxlength: [160, 'Tagline cannot exceed 160 characters'],
      default: null,
    },

    description: {
      type: String,
      trim: true,
      minlength: [50, 'Description must be at least 50 characters'],
      maxlength: [3000, 'Description cannot exceed 3000 characters'],
      default: null,
    },

    // Investor-facing 1–2 paragraph pitch
    pitchSummary: {
      type: String,
      trim: true,
      maxlength: [2000, 'Pitch summary cannot exceed 2000 characters'],
      default: null,
    },

    problemStatement: {
      type: String,
      trim: true,
      maxlength: [2000, 'Problem statement cannot exceed 2000 characters'],
      default: null,
    },

    solutionDescription: {
      type: String,
      trim: true,
      maxlength: [2000, 'Solution description cannot exceed 2000 characters'],
      default: null,
    },

    targetMarket: {
      type: String,
      trim: true,
      maxlength: [1000, 'Target market cannot exceed 1000 characters'],
      default: null,
    },

    tractionSummary: {
      type: String,
      trim: true,
      maxlength: [1500, 'Traction summary cannot exceed 1500 characters'],
      default: null,
    },

    // ── Categorization ─────────────────────────────────────────────────────
    industry: {
      type: String,
      required: [true, 'Industry is required'],
      enum: {
        values: [
          'fintech',
          'healthtech',
          'edtech',
          'ecommerce',
          'agritech',
          'saas',
          'logistics',
          'cleantech',
          'proptech',
          'other',
        ],
        message: 'Please select a valid industry',
      },
    },

    tags: {
      type: [String],
      default: [],
      validate: {
        validator: (arr) => arr.length <= 10,
        message: 'Cannot have more than 10 tags',
      },
    },

    // ── Funding ────────────────────────────────────────────────────────────
    // Note: fundingGoal lives on the Campaign model when a campaign is created.
    // Here we store the startup's general funding stage for discovery purposes.
    fundingStage: {
      type: String,
      enum: {
        values: ['pre_seed', 'seed', 'series_a', 'series_b', 'other'],
        message: 'Invalid funding stage',
      },
      default: 'pre_seed',
    },

    // ── Business Details ───────────────────────────────────────────────────
    legalEntityType: {
      type: String,
      enum: {
        values: ['private_limited', 'llp', 'partnership', 'sole_proprietorship', 'other'],
        message: 'Invalid legal entity type',
      },
      default: 'private_limited',
    },

    mcaRegistrationNumber: {
      type: String,
      trim: true,
      default: null,
    },

    panNumber: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },

    // ISO date string e.g. '2021-03-15'
    incorporationDate: {
      type: Date,
      default: null,
    },

    // 'MCA' | 'startup_india' | 'other'
    registrationType: {
      type: String,
      enum: {
        values: ['mca', 'startup_india', 'llp', 'other'],
        message: 'Invalid registration type',
      },
      default: null,
    },

    website: {
      type: String,
      trim: true,
      default: null,
      match: [
        /^(https?:\/\/)?([\w-]+(\.[\w-]+)+)(\/[\w-./?%&=]*)?$/,
        'Please provide a valid URL',
      ],
    },

    location: {
      city: {
        type: String,
        trim: true,
        default: null,
      },
      country: {
        type: String,
        trim: true,
        default: null,
      },
    },

    foundedYear: {
      type: Number,
      min: [1900, 'Founded year must be after 1900'],
      max: [new Date().getFullYear(), 'Founded year cannot be in the future'],
      default: null,
    },

    teamSize: {
      type: Number,
      min: [1, 'Team size must be at least 1'],
      max: [10000, 'Team size seems too large'],
      default: null,
    },

    // ── Team ───────────────────────────────────────────────────────────────
    teamMembers: {
      type: [teamMemberSchema],
      default: [],
      validate: {
        validator: (arr) => arr.length <= 20,
        message: 'Cannot have more than 20 team members',
      },
    },

    // ── Documents ──────────────────────────────────────────────────────────
    documents: {
      type: [documentSchema],
      default: [],
      validate: {
        validator: (arr) => arr.length <= 10,
        message: 'Cannot upload more than 10 documents',
      },
    },

    // ── Social Links ───────────────────────────────────────────────────────
    socialLinks: {
      twitter: { type: String, default: null },
      linkedIn: { type: String, default: null },
      github:   { type: String, default: null },
    },

    // ── Financials ─────────────────────────────────────────────────────────
    financialData: {
      type: financialDataSchema,
      default: () => ({}),
    },

    // ── KYC / Verification Documents ───────────────────────────────────────
    // Identity + company documents required for KYB verification
    kycDocuments: {
      type: [documentMetaSchema],
      default: [],
      validate: {
        validator: (arr) => arr.length <= 15,
        message: 'Cannot upload more than 15 KYC documents',
      },
    },

    // Business/financial documents (pitch deck, CA certificate, etc.)
    businessVerificationDocuments: {
      type: [documentMetaSchema],
      default: [],
      validate: {
        validator: (arr) => arr.length <= 15,
        message: 'Cannot upload more than 15 business verification documents',
      },
    },

    // ── Verification (admin-set only) ──────────────────────────────────────
    verificationStatus: {
      type: String,
      enum: {
        values: ['draft', 'submitted', 'pending', 'in_review', 'approved', 'rejected', 'more_info_required'],
        message: 'Invalid verification status',
      },
      default: 'draft',  // new profiles start as drafts
    },

    isVerified: {
      type: Boolean,
      default: false,
    },

    verifiedAt: {
      type: Date,
      default: null,
    },

    submittedAt: {
      type: Date,
      default: null,
    },

    rejectionReason: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },  // include virtuals in JSON output
    toObject: { virtuals: true },  // include virtuals in object output
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

// userId unique index already created by schema field { unique: true }
startupProfileSchema.index({ industry: 1 });
startupProfileSchema.index({ verificationStatus: 1 });
startupProfileSchema.index({ isVerified: 1 });
startupProfileSchema.index({ fundingStage: 1 });
startupProfileSchema.index({ createdAt: -1 });
startupProfileSchema.index({ 'location.country': 1 });
// Text search index for startup name and description discovery
startupProfileSchema.index(
  { startupName: 'text', description: 'text', tags: 'text' },
  { name: 'startup_text_search' }
);

// ─── Virtual: profileCompleteness ─────────────────────────────────────────────
/**
 * Computes a 0–100 score based on how complete the profile is.
 * Used in discovery weighting and displayed on the startup card.
 *
 * Scoring breakdown (sums to 100):
 *   startupName   → 10  (required, but score reflects quality signal)
 *   tagline       → 10
 *   description   → 15
 *   industry      → 10  (required)
 *   website       → 10
 *   foundedYear   →  5
 *   teamMembers   → 20  (at least one member with name + role)
 *   documents     → 20  (at least one document uploaded)
 */
startupProfileSchema.virtual('profileCompleteness').get(function () {
  let score = 0;

  if (this.startupName)                                       score += 10;
  if (this.tagline)                                           score += 10;
  if (this.description && this.description.length >= 50)     score += 15;
  if (this.industry)                                          score += 10;
  if (this.website)                                           score += 10;
  if (this.foundedYear)                                       score +=  5;
  if (this.teamMembers && this.teamMembers.length > 0)       score += 20;
  if (this.documents && this.documents.length > 0)           score += 20;

  return score; // 0–100
});

/**
 * Derives a human-readable completeness label from the score.
 * Used in UI badges.
 */
startupProfileSchema.virtual('completenessLabel').get(function () {
  const score = this.profileCompleteness;
  if (score >= 90) return 'Complete';
  if (score >= 70) return 'Strong';
  if (score >= 50) return 'Moderate';
  if (score >= 30) return 'Basic';
  return 'Incomplete';
});

const StartupProfile = mongoose.model('StartupProfile', startupProfileSchema);

module.exports = StartupProfile;
