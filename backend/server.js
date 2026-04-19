/**
 * server.js
 *
 * Application entry point.
 *
 * Responsibilities:
 *  1. Load environment config
 *  2. Connect to MongoDB
 *  3. Start the HTTP server
 *  4. Handle unhandled rejections and uncaught exceptions
 *
 * This file does NOT contain application logic — that lives in src/app.js.
 */

'use strict';

// Must be first — loads .env before any other module reads process.env
const env        = require('./src/config/env');
const connectDB  = require('./src/config/db');
const app        = require('./src/app');
const { validateBlockchainEnvOrWarn } = require('./src/config/blockchain');
const anchorRetryJob = require('./src/jobs/anchorRetry.job');
const { startSyncService, stopSyncService } = require('./src/services/blockchainSync.service');

// ─── Uncaught Exception Guard ────────────────────────────────────────────────
// Catches synchronous errors that escape all try/catch blocks
// Log and exit — cannot guarantee app state after an uncaught exception
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught Exception:'.red.bold, err.message);
  console.error(err.stack);
  process.exit(1);
});

// ─── Boot Sequence ───────────────────────────────────────────────────────────

const start = async () => {
  // 1. Connect to database before accepting any requests
  await connectDB();

  // 2. Start HTTP server
  const server = app.listen(env.PORT, '0.0.0.0', () => {
    console.log(
      `[SERVER] Running in ${env.NODE_ENV} mode on port ${env.PORT}`.green.bold
    );
    console.log(`[SERVER] API Base: http://localhost:${env.PORT}/api/v1`.cyan);
    console.log(`[SERVER] Health:   http://localhost:${env.PORT}/api/v1/health`.cyan);

    // Surface blockchain config state at every startup.
    validateBlockchainEnvOrWarn();

    // Start the anchor retry job — polls every 2 min for unanchored bundles.
    // The job silently skips if blockchain is not configured (dev/stub mode).
    anchorRetryJob.start();

    // Start background sync service to listen to on-chain events and keep MongoDB in sync
    startSyncService();

    if (env.isDev && env.DEV_STUB_BLOCKCHAIN_MODE) {
      console.warn('[CONFIG] 🚧 DEV_STUB_BLOCKCHAIN_MODE=true — on-chain verification bypassed (dev only)');
    }
  });

  // 3. Unhandled Promise Rejection Guard
  // Catches async errors that escape all try/catch blocks
  // Graceful shutdown: close server first, then exit
  process.on('unhandledRejection', (err) => {
    console.error('[FATAL] Unhandled Rejection:'.red.bold, err.message);
    console.error(err.stack);
    server.close(() => {
      console.log('[SERVER] Shutting down gracefully...'.yellow);
      process.exit(1);
    });
  });

  // 4. Graceful shutdown on SIGTERM (e.g. from Docker, Railway, Render)
  process.on('SIGTERM', () => {
    console.log('[SERVER] SIGTERM received. Closing HTTP server...'.yellow);
    stopSyncService();
    server.close(() => {
      console.log('[SERVER] HTTP server closed.'.yellow);
      process.exit(0);
    });
  });
};

start();
