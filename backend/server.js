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
const env = require('./src/config/env');
const connectDB = require('./src/config/db');
const app = require('./src/app');

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

    // UPDATED FOR LOCAL QA PREP — show which dev modes are active at startup
    if (env.isDev) {
      const razorpayOk    = !!(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);
      const blockchainOk  = !!(env.ALCHEMY_RPC_URL && env.ADMIN_WALLET_PRIVATE_KEY && env.INVESTMENT_LOGGER_CONTRACT_ADDRESS);
      console.log('\n[CONFIG] ─────────────────────────────────────────');
      console.log(`[CONFIG] Razorpay configured   : ${razorpayOk   ? '✅ yes' : '⚠️  no  (DEV_BYPASS_PAYMENT required to test payments)'}`);
      console.log(`[CONFIG] Blockchain configured : ${blockchainOk ? '✅ yes' : '⚠️  no  (transparency logging will degrade gracefully)'}`);
      console.log(`[CONFIG] DEV_BYPASS_PAYMENT    : ${env.DEV_BYPASS_PAYMENT   ? '🚧 ON  ← dev only, never use in prod' : 'off'}`);
      console.log(`[CONFIG] DEV_SKIP_BLOCKCHAIN   : ${env.DEV_SKIP_BLOCKCHAIN  ? '🚧 ON  ← dev only, never use in prod' : 'off'}`);
      console.log('[CONFIG] ─────────────────────────────────────────\n');
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
    server.close(() => {
      console.log('[SERVER] HTTP server closed.'.yellow);
      process.exit(0);
    });
  });
};

start();
