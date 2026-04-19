/**
 * src/tests/helpers/globalSetup.js
 *
 * Runs ONCE before all test suites (Jest globalSetup).
 * Patches process.env so that every module loaded under tests sees correct values
 * without needing a real .env file.
 *
 * This file must NOT import any application modules — it runs in a separate
 * worker context before the test environment is fully initialised.
 */

'use strict';

module.exports = async function globalSetup() {
  // ── Core server config ──────────────────────────────────────────────────────
  process.env.NODE_ENV          = 'test';
  process.env.PORT              = '5099';
  process.env.JWT_SECRET        = 'jest-test-secret-do-not-use-in-production';
  process.env.JWT_EXPIRE        = '1h';

  // ── Blockchain — stub mode so no RPC calls hit the wire ────────────────────
  // Individual tests that need a real provider will override these values
  // inside the test using jest.mock() or beforeAll env patching.
  process.env.DEV_STUB_BLOCKCHAIN_MODE = 'true';
  process.env.ALCHEMY_RPC_URL          = '';
  process.env.CONTRACT_ADDRESS         = '';
  process.env.ADMIN_WALLET_PRIVATE_KEY = '';

  // ── Feature flags ───────────────────────────────────────────────────────────
  process.env.DEV_SKIP_BLOCKCHAIN = 'false';
  process.env.DEV_BYPASS_PAYMENT  = 'false';
  process.env.STUB_MODE           = 'false';

  // ── MONGO_URI is set per-suite via MongoMemoryServer ─────────────────────
  // globalSetup cannot share an in-memory server instance with test workers,
  // so each test file creates its own MongoMemoryServer and sets process.env.MONGO_URI
  // in its beforeAll() hook (see dbHelper.js).

  // ── Misc ───────────────────────────────────────────────────────────────────
  process.env.FRONTEND_URL        = 'http://localhost:5173';
  process.env.EVIDENCE_STORAGE_ROOT = '';
};
