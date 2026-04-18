/**
 * src/validators/startup.validators.js
 *
 * Validation rules for startup profile endpoints.
 *
 * Strategy:
 *  - createProfileValidation: stricter — required name, description, industry
 *  - updateProfileValidation: all fields optional — only validate what's sent
 *  - teamMemberValidation / documentValidation: for adding specific subdocuments
 */

const { body } = require('express-validator');

const VALID_INDUSTRIES = [
  'fintech', 'healthtech', 'edtech', 'ecommerce',
  'agritech', 'saas', 'logistics', 'cleantech', 'proptech', 'other',
];

const VALID_FUNDING_STAGES = ['pre_seed', 'seed', 'series_a', 'series_b', 'other'];

const VALID_DOC_TYPES = ['pitch_deck', 'financials', 'legal', 'product_demo', 'other'];

// ─── Reusable Field Rules ─────────────────────────────────────────────────────

const nameRule = (required = true) => {
  const rule = body('startupName').trim();
  return required
    ? rule.notEmpty().withMessage('Startup name is required')
         .isLength({ max: 100 }).withMessage('Startup name cannot exceed 100 characters')
    : rule.optional({ nullable: true })
         .isLength({ max: 100 }).withMessage('Startup name cannot exceed 100 characters');
};

const descriptionRule = (required = true) => {
  const rule = body('description').trim();
  return required
    ? rule.notEmpty().withMessage('Description is required')
         .isLength({ min: 50, max: 3000 }).withMessage('Description must be between 50 and 3000 characters')
    : rule.optional({ nullable: true })
         .isLength({ min: 50, max: 3000 }).withMessage('Description must be between 50 and 3000 characters');
};

const industryRule = (required = true) => {
  const rule = body('industry');
  return required
    ? rule.notEmpty().withMessage('Industry is required')
         .isIn(VALID_INDUSTRIES).withMessage(`Industry must be one of: ${VALID_INDUSTRIES.join(', ')}`)
    : rule.optional({ nullable: true })
         .isIn(VALID_INDUSTRIES).withMessage(`Industry must be one of: ${VALID_INDUSTRIES.join(', ')}`);
};

// ─── Create Profile Validation ────────────────────────────────────────────────

const createProfileValidation = [
  nameRule(true),
  descriptionRule(true),
  industryRule(true),

  body('tagline')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 160 }).withMessage('Tagline cannot exceed 160 characters'),

  body('website')
    .optional({ nullable: true })
    .trim()
    .isURL({ require_protocol: false }).withMessage('Please provide a valid website URL'),

  body('foundedYear')
    .optional({ nullable: true })
    .isInt({ min: 1900, max: new Date().getFullYear() })
    .withMessage(`Founded year must be between 1900 and ${new Date().getFullYear()}`),

  body('teamSize')
    .optional({ nullable: true })
    .isInt({ min: 1 }).withMessage('Team size must be at least 1'),

  body('fundingStage')
    .optional({ nullable: true })
    .isIn(VALID_FUNDING_STAGES).withMessage(`Funding stage must be one of: ${VALID_FUNDING_STAGES.join(', ')}`),

  body('location.city')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 80 }).withMessage('City name cannot exceed 80 characters'),

  body('location.country')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 80 }).withMessage('Country name cannot exceed 80 characters'),

  body('tags')
    .optional()
    .isArray({ max: 10 }).withMessage('Tags must be an array with at most 10 items'),

  body('tags.*')
    .optional()
    .isString().withMessage('Each tag must be a string')
    .trim()
    .isLength({ max: 30 }).withMessage('Each tag cannot exceed 30 characters'),

  // Team member validation (when provided in create payload)
  body('teamMembers')
    .optional()
    .isArray({ max: 20 }).withMessage('Team members must be an array with at most 20 items'),

  body('teamMembers.*.name')
    .if(body('teamMembers').exists())
    .notEmpty().withMessage('Team member name is required')
    .trim()
    .isLength({ max: 80 }),

  body('teamMembers.*.role')
    .if(body('teamMembers').exists())
    .notEmpty().withMessage('Team member role is required')
    .trim()
    .isLength({ max: 80 }),

  body('teamMembers.*.bio')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 500 }).withMessage('Bio cannot exceed 500 characters'),

  body('teamMembers.*.linkedIn')
    .optional({ nullable: true })
    .trim(),

  // Document validation (when provided in create payload)
  body('documents')
    .optional()
    .isArray({ max: 10 }).withMessage('Documents must be an array with at most 10 items'),

  body('documents.*.docType')
    .if(body('documents').exists())
    .notEmpty().withMessage('Document type is required')
    .isIn(VALID_DOC_TYPES).withMessage(`Document type must be one of: ${VALID_DOC_TYPES.join(', ')}`),

  body('documents.*.url')
    .if(body('documents').exists())
    .notEmpty().withMessage('Document URL is required')
    .trim(),

  body('documents.*.label')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 100 }),

  // Social links
  body('socialLinks.twitter').optional({ nullable: true }).trim(),
  body('socialLinks.linkedIn').optional({ nullable: true }).trim(),
  body('socialLinks.github').optional({ nullable: true }).trim(),
];

// ─── Update Profile Validation ────────────────────────────────────────────────
// All fields optional — only validate what is actually sent

const updateProfileValidation = [
  nameRule(false),
  descriptionRule(false),
  industryRule(false),

  body('tagline').optional({ nullable: true }).trim()
    .isLength({ max: 160 }).withMessage('Tagline cannot exceed 160 characters'),

  body('website').optional({ nullable: true }).trim()
    .isURL({ require_protocol: false }).withMessage('Please provide a valid website URL'),

  body('foundedYear').optional({ nullable: true })
    .isInt({ min: 1900, max: new Date().getFullYear() })
    .withMessage('Invalid founded year'),

  body('teamSize').optional({ nullable: true })
    .isInt({ min: 1 }).withMessage('Team size must be at least 1'),

  body('fundingStage').optional({ nullable: true })
    .isIn(VALID_FUNDING_STAGES).withMessage('Invalid funding stage'),

  body('location.city').optional({ nullable: true }).trim()
    .isLength({ max: 80 }),

  body('location.country').optional({ nullable: true }).trim()
    .isLength({ max: 80 }),

  body('tags').optional().isArray({ max: 10 }),
  body('tags.*').optional().isString().trim().isLength({ max: 30 }),

  body('documents').optional().isArray({ max: 10 }),
  body('documents.*.docType').optional()
    .isIn(VALID_DOC_TYPES).withMessage('Invalid document type'),
  body('documents.*.url').optional().notEmpty().trim(),
  body('documents.*.label').optional({ nullable: true }).trim().isLength({ max: 100 }),

  body('teamMembers').optional().isArray({ max: 20 }),
  body('teamMembers.*.name').optional().notEmpty().trim(),
  body('teamMembers.*.role').optional().notEmpty().trim(),
  body('teamMembers.*.bio').optional({ nullable: true }).trim().isLength({ max: 500 }),

  body('socialLinks.twitter').optional({ nullable: true }).trim(),
  body('socialLinks.linkedIn').optional({ nullable: true }).trim(),
  body('socialLinks.github').optional({ nullable: true }).trim(),
];

module.exports = {
  createProfileValidation,
  updateProfileValidation,
};
