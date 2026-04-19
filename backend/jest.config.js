/**
 * jest.config.js
 *
 * Jest configuration for Enigma backend integration tests.
 *
 * Key decisions:
 *  - testEnvironment: 'node'  — no DOM shims, pure Node.js
 *  - testTimeout: 30_000      — MongoMemoryServer cold-start can be slow
 *  - --runInBand (CLI flag)   — ensures DB lifecycle tests don't leak state
 *    across parallel workers (MongoMemoryServer has per-suite teardown)
 *  - setupFilesAfterFramework: global env patches before each test module loads
 *  - coverageDirectory: './coverage'
 */

'use strict';

module.exports = {
  testEnvironment: 'node',

  // Only discover tests in our integration suite (not scripts/ or models/ etc.)
  testMatch: ['**/src/tests/integration/**/*.test.js'],

  // Global setup helper — patches process.env before every suite
  globalSetup: './src/tests/helpers/globalSetup.js',

  // 30 s per test — generous for MongoMemoryServer cold starts
  testTimeout: 30_000,

  // Clear mocks between tests (prevents spy state leakage)
  clearMocks: true,
  restoreMocks: true,

  // Coverage config
  collectCoverageFrom: [
    'src/controllers/**/*.js',
    'src/services/**/*.js',
    '!src/services/blockchainLogging.service.js', // deprecated
  ],
  coverageDirectory: './coverage',
  coverageReporters: ['text', 'lcov'],

  // Verbose output in CI
  verbose: true,
};
