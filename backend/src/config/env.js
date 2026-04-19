/**
 * src/config/env.js
 *
 * Centralizes all environment variable access.
 * Throws immediately at startup if a required variable is missing.
 * Import this module anywhere instead of using process.env directly.
 */

const path = require('path');
const dotenv = require('dotenv');

require('colors'); // UPDATED FOR DEPLOYMENT PREP: required for colorized fatal errors

// ─── Environment Loading ─────────────────────────────────────────────────────

// 1. Try to load from root level .env (standard for cloud platforms like Heroku/Vercel)
dotenv.config();

// 2. Fallback to the specific backend folder .env structure if root not found
// (Maintains compatibility with the existing local setup)
dotenv.config({ path: path.resolve(__dirname, '../../.env/.env') });

const isProduction = process.env.NODE_ENV === 'production';

// ─── Validation ──────────────────────────────────────────────────────────────

const required = [
  'PORT',
  'MONGO_URI',
  'JWT_SECRET',
];

if (isProduction) {
  // In production, we MUST have a frontend URL and JWT expiry.
  // Razorpay keys are NOT required — that route is now deprecated (/payments-legacy).
  required.push('FRONTEND_URL');
  required.push('JWT_EXPIRE');
}

// Fail fast — catch missing configuration before the server starts
const missing = required.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`\n[FATAL] ${isProduction ? 'PRODUCTION ' : ''}CONFIG ERROR: Missing required environment variables:`.red.bold);
  missing.forEach(key => console.error(`   - ${key}`.red));
  console.error('\nPlease check your .env file or cloud environment settings.\n'.yellow);
  process.exit(1);
}

// ─── Config Export ────────────────────────────────────────────────────────────

const env = {
  // Server
  PORT: parseInt(process.env.PORT, 10) || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  isDev: !isProduction,

  // MongoDB
  MONGO_URI: process.env.MONGO_URI,

  // JWT
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRE: process.env.JWT_EXPIRE || '7d',

  // Blockchain (optional at startup — investment endpoint fails fast if missing without stub mode)
  ALCHEMY_RPC_URL:          process.env.ALCHEMY_RPC_URL          || '',
  ADMIN_WALLET_PRIVATE_KEY: process.env.ADMIN_WALLET_PRIVATE_KEY || '',
  CONTRACT_ADDRESS:         process.env.CONTRACT_ADDRESS         || '',
  // Legacy — retained for existing blockchainLogging.service references only
  INVESTMENT_LOGGER_CONTRACT_ADDRESS: process.env.INVESTMENT_LOGGER_CONTRACT_ADDRESS || '',

  // Evidence storage — local filesystem (Phase 5)
  // Override to an absolute path if you want files outside the repo.
  // When migrating to IPFS/S3, remove this and add the new storage env vars here.
  EVIDENCE_STORAGE_ROOT: process.env.EVIDENCE_STORAGE_ROOT || '',

  // ── Dev-only bypass flags — NEVER true in production ──────────────────────
  // These flags are zeroed out in the post-load production guard below.

  // DEV_STUB_BLOCKCHAIN_MODE=true  → POST /investments skips on-chain verification.
  // Investments get status:'stub' (distinct from 'confirmed') + a console.warn each call.
  // Use for local development without a deployed contract or RPC node.
  DEV_STUB_BLOCKCHAIN_MODE: !isProduction && process.env.DEV_STUB_BLOCKCHAIN_MODE === 'true',

  DEV_SKIP_BLOCKCHAIN: !isProduction && process.env.DEV_SKIP_BLOCKCHAIN === 'true',
  DEV_BYPASS_PAYMENT:  !isProduction && process.env.DEV_BYPASS_PAYMENT  === 'true',
  STUB_MODE:           !isProduction && (process.env.STUB_MODE === 'true'),

  // Admin seed credentials
  ADMIN_EMAIL:    process.env.ADMIN_EMAIL    || 'admin@enigmainvest.dev',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'Admin@1234',

  // CORS
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',

  // Razorpay
  RAZORPAY_KEY_ID:     process.env.RAZORPAY_KEY_ID     || '',
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || '',
};

// ─── Post-Load Assurance ──────────────────────────────────────────────────────
if (isProduction) {
  const bypassFlags = [
    env.DEV_BYPASS_PAYMENT,
    env.DEV_SKIP_BLOCKCHAIN,
    env.STUB_MODE,
    env.DEV_STUB_BLOCKCHAIN_MODE,
  ];
  if (bypassFlags.some(Boolean)) {
    console.error('[CRITICAL SECURITY ALERT] Developer bypass flags detected as TRUE in production! Force-disabling.'.red.bold);
    env.DEV_BYPASS_PAYMENT       = false;
    env.DEV_SKIP_BLOCKCHAIN      = false;
    env.STUB_MODE                = false;
    env.DEV_STUB_BLOCKCHAIN_MODE = false;
  }
}

module.exports = env;
