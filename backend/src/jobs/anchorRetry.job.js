/**
 * src/jobs/anchorRetry.job.js
 *
 * Crash-recovery retry job for evidence anchor submissions.
 *
 * ── Problem it solves ─────────────────────────────────────────────────────────
 *   If the Node.js process crashes (OOM, restart, SIGKILL) after a file upload
 *   is processed (onChainStatus: 'processed') but before the anchor tx is sent
 *   and confirmed, the bundle will be stuck with onChainStatus: 'processed' or
 *   'anchor_failed' forever.
 *
 *   This job runs on a timer (every 2 minutes by default) and retries any such
 *   bundles, calling evidenceAnchor.service.anchorBundle() on each.
 *
 * ── Safety guarantees ─────────────────────────────────────────────────────────
 *   1. Only runs if blockchain is configured (skips silently in DEV_STUB mode).
 *   2. Bundles stuck in 'anchoring' state (process died mid-flight) are treated
 *      as 'anchor_failed' after a 10-minute timeout — contract double-submit
 *      rejection is handled gracefully via crash-recovery in anchorBundle().
 *   3. One bundle per tick — no concurrent submissions (prevents nonce races).
 *   4. Maximum 5 consecutive errors before the job pauses itself and logs a
 *      CRITICAL alert.
 *
 * ── Registration ──────────────────────────────────────────────────────────────
 *   Called from server.js like:
 *     const anchorRetryJob = require('./jobs/anchorRetry.job');
 *     anchorRetryJob.start();
 *
 *   It is safe to call start() multiple times — idempotent guard inside.
 */

'use strict';

const { isBlockchainConfigured }  = require('../config/blockchain');
const { anchorBundle, listStuckBundles } = require('../services/evidenceAnchor.service');
const EvidenceBundle              = require('../models/EvidenceBundle');

// ─── Config ───────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS      = 2 * 60 * 1000;  // 2 minutes
const STUCK_ANCHORING_MIN   = 10;              // treat 'anchoring' > 10 min as failed
const MAX_CONSECUTIVE_ERRORS = 5;

// ─── State ────────────────────────────────────────────────────────────────────

let _timer              = null;
let _running            = false;
let _consecutiveErrors  = 0;

// ─── Internal ─────────────────────────────────────────────────────────────────

/**
 * Un-stick bundles that got stranded in 'anchoring' state
 * (process died between tx send and MongoDB update).
 * After the timeout, anchorBundle() will call the contract which will either:
 *   a) still accept the submission (tx never landed) — normal flow
 *   b) reject with "already submitted" → crash-recovery event lookup
 */
async function resetStrandedAnchoring() {
  const cutoff = new Date(Date.now() - STUCK_ANCHORING_MIN * 60 * 1000);
  await EvidenceBundle.updateMany(
    { onChainStatus: 'anchoring', updatedAt: { $lt: cutoff } },
    { $set: { onChainStatus: 'anchor_failed', anchorError: 'Auto-reset: process died during anchoring' } }
  );
}

async function tick() {
  if (!isBlockchainConfigured()) return; // silent skip in dev/stub mode

  try {
    await resetStrandedAnchoring();

    const stuck = await listStuckBundles(5); // > 5 minutes old
    if (stuck.length === 0) return;

    console.log(`[anchorRetry] ${stuck.length} bundle(s) pending anchor`);

    // Process one at a time to avoid nonce race conditions
    for (const b of stuck) {
      try {
        const result = await anchorBundle(b._id);
        console.log(`[anchorRetry] ✅ Anchored ${b._id} | tx ${result.txHash} | recovered=${result.recovered}`);
        _consecutiveErrors = 0;
      } catch (err) {
        _consecutiveErrors++;
        console.error(`[anchorRetry] ❌ Failed to anchor ${b._id}: ${err.message}`);

        if (_consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          console.error(
            `[anchorRetry] CRITICAL: ${MAX_CONSECUTIVE_ERRORS} consecutive errors. ` +
            'Pausing retry job. Check ALCHEMY_RPC_URL and contract state.'
          );
          stop();
          return;
        }
      }
    }
  } catch (err) {
    console.error(`[anchorRetry] Unexpected tick error: ${err.message}`);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

function start() {
  if (_timer) return; // idempotent

  console.log(`[anchorRetry] Starting — polling every ${POLL_INTERVAL_MS / 1000}s`);

  // Run immediately on startup, then on interval
  tick();
  _timer = setInterval(tick, POLL_INTERVAL_MS);
  // unref() so the job doesn't prevent Node from exiting in tests
  if (_timer.unref) _timer.unref();
}

function stop() {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
    console.log('[anchorRetry] Stopped');
  }
}

function isRunning() {
  return _timer !== null;
}

module.exports = { start, stop, isRunning };
