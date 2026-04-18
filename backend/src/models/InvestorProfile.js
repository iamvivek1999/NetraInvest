const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  documentType: {
    type: String,
    enum: ['pan_card', 'aadhaar_card', 'passport', 'other'],
    required: true,
  },
  fileUrl: {
    type: String, // S3 or IPFS url
    required: false,
  },
  fileName: {
    type: String,
    required: false,
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
  }
}, { _id: true });

const investorProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true, // for faster queries
  },
  
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  
  bio: { type: String },
  linkedInUrl: { type: String },
  twitterUrl: { type: String },
  
  // KYC / Compliance related
  verificationStatus: {
    type: String,
    enum: ['pending', 'in_review', 'approved', 'rejected', 'more_info_required'],
    default: 'pending',
    index: true,
  },
  rejectionReason: {
    type: String,
    default: null,
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  verifiedAt: {
    type: Date,
    default: null,
  },
  
  documents: [documentSchema],
  
  phone: { type: String }, // Added for InvestorProfile specifically
  riskAppetite: {
    type: String,
    enum: ['low', 'medium', 'high'],
  },
  
  // Investment preferences (optional)
  preferredStages: [{
    type: String,
    enum: ['pre_seed', 'seed', 'series_a', 'series_b', 'growth'] // e.g., 'seed', 'series_a'
  }],
  preferredIndustries: [{ type: String }],
  preferredSectors: [{ type: String }], // Keeping matching schema field for User requests
  
  investmentRange: {
    min: { type: Number, default: 0 },
    max: { type: Number, default: 0 }
  },
  premiumStatus: {
    type: Boolean,
    default: false
  },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Update timestamps on save
investorProfileSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

// Virtual for profile completeness (optional convenience)
investorProfileSchema.virtual('profileCompleteness').get(function() {
  let score = 0;
  if (this.firstName && this.lastName) score += 20;
  if (this.bio) score += 20;
  if (this.linkedInUrl) score += 10;
  if (this.preferredStages && this.preferredStages.length) score += 5;
  if (this.preferredIndustries && this.preferredIndustries.length) score += 5;
  if (this.preferredSectors && this.preferredSectors.length) score += 5;
  if (this.riskAppetite) score += 5;
  if (this.phone) score += 5;
  if (this.documents && this.documents.length) score += 25;
  
  return Math.min(score, 100);
});

module.exports = mongoose.model('InvestorProfile', investorProfileSchema);
