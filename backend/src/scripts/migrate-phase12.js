/**
 * src/scripts/migrate-phase12.js
 *
 * Phase 12 — Idempotent database migration script.
 *
 * Run modes:
 *   node src/scripts/migrate-phase12.js            → live migration
 *   node src/scripts/migrate-phase12.js --dry-run  → prints what would change, no writes
 *
 * Migrations performed:
 *   1. Investment.syncStatus backfill   — old 'status' field → syncStatus enum mapping
 *   2. Investment.blockchainStatus      — legacy field → moved to verificationNote
 *   3. Razorpay investment reclassify   — paymentProvider='razorpay' → sourceOfTruth='local'
 *   4. EvidenceBundle null status fix   — onChainStatus=null → 'processed'
 *   5. Campaign totalRaisedWei backfill — numeric currentRaised without totalRaisedWei
 *
 * All migrations are idempotent — safe to re-run multiple times.
 */

'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env/.env') });
require('dotenv').config();

const mongoose = require('mongoose');

const DRY_RUN = process.argv.includes('--dry-run');

// ─── Logging ─────────────────────────────────────────────────────────────────

const log  = (msg) => console.log(`  ✅ ${msg}`);
const info = (msg) => console.log(`  ℹ️  ${msg}`);
const warn = (msg) => console.warn(`  ⚠️  ${msg}`);
const dryLog = (msg) => DRY_RUN && console.log(`  [DRY-RUN] ${msg}`);

// ─── Models (inline — avoid requiring full app stack) ─────────────────────────

const Investment   = require('../models/Investment');
const EvidenceBundle = require('../models/EvidenceBundle');
const Campaign     = require('../models/Campaign');

// ─── Migration Utilities ─────────────────────────────────────────────────────

/**
 * Wrap a mongoose write with dry-run awareness.
 * @param {string} label   - Human-readable description
 * @param {Function} fn    - Async function that performs the write
 * @returns {Promise<number>} - Number of documents modified
 */
const migrate = async (label, fn) => {
  console.log(`\n  ► ${label}`);
  if (DRY_RUN) {
    dryLog('Would execute: ' + label);
    return 0;
  }
  try {
    const modified = await fn();
    log(`Done — ${modified} document(s) updated`);
    return modified;
  } catch (err) {
    warn(`Failed: ${err.message}`);
    throw err;
  }
};

// ─── Migration Steps ──────────────────────────────────────────────────────────

/**
 * 1. Backfill Investment.syncStatus from legacy `status` field.
 *    Old schema used: Investment.status ∈ ['pending', 'confirmed', 'unverified', 'failed']
 *    New schema uses: Investment.syncStatus ∈ ['pending', 'confirmed', 'failed', ...]
 */
async function migrateLegacyStatusField() {
  return migrate('Backfill Investment.syncStatus from legacy .status field', async () => {
    // Find investments that have no syncStatus (for backwards compat) or have old .status
    const legacyInvs = await Investment.find({
      $and: [
        // Has a raw 'status' field in the document (legacy BSON key)
        { 'status': { $exists: true } },
        // But syncStatus is still default/pending
        { syncStatus: { $in: ['pending', null] } },
      ],
    }).select('status syncStatus').lean();

    if (legacyInvs.length === 0) {
      info('No legacy .status investments found — skip');
      return 0;
    }

    info(`Found ${legacyInvs.length} investments with legacy .status field`);

    const STATUS_MAP = {
      confirmed:  'confirmed',
      unverified: 'confirmed', // treat old unverified as confirmed (was just no-chain-check)
      pending:    'pending',
      failed:     'failed',
    };

    let modified = 0;
    for (const inv of legacyInvs) {
      const mapped = STATUS_MAP[inv.status] || 'pending';
      await Investment.updateOne(
        { _id: inv._id },
        {
          $set: { syncStatus: mapped },
          $unset: { status: '' },
        }
      );
      modified++;
    }
    return modified;
  });
}

/**
 * 2. Move legacy `blockchainStatus` field content to verificationNote.
 *    Old field was added in an earlier migration attempt.
 */
async function migrateLegacyBlockchainStatusField() {
  return migrate('Move Investment.blockchainStatus → verificationNote', async () => {
    const docs = await Investment.find({
      blockchainStatus: { $exists: true },
    }).select('blockchainStatus verificationNote').lean();

    if (docs.length === 0) {
      info('No investments with .blockchainStatus found — skip');
      return 0;
    }

    let modified = 0;
    for (const doc of docs) {
      const note = doc.verificationNote
        ? `${doc.verificationNote} | legacy.blockchainStatus: ${doc.blockchainStatus}`
        : `legacy.blockchainStatus: ${doc.blockchainStatus}`;

      await Investment.updateOne(
        { _id: doc._id },
        {
          $set:   { verificationNote: note },
          $unset: { blockchainStatus: '' },
        }
      );
      modified++;
    }
    return modified;
  });
}

/**
 * 3. Reclassify Razorpay investments: set sourceOfTruth='local', update verificationNote.
 */
async function migrateRazorpayInvestments() {
  return migrate('Reclassify Razorpay investments as sourceOfTruth=local', async () => {
    const result = await Investment.updateMany(
      {
        paymentProvider: 'razorpay',
        sourceOfTruth: { $ne: 'local' }, // idempotent — don't re-process
      },
      {
        $set: {
          sourceOfTruth: 'local',
          syncStatus: 'confirmed',  // Razorpay payments were confirmed off-chain
        },
        $currentDate: { updatedAt: true },
      }
    );
    return result.modifiedCount;
  });
}

/**
 * 4. Fix EvidenceBundle documents with null onChainStatus → set to 'processed'.
 */
async function fixNullEvidenceBundleStatus() {
  return migrate('Fix EvidenceBundle.onChainStatus null → processed', async () => {
    const result = await EvidenceBundle.updateMany(
      { onChainStatus: null },
      {
        $set: { onChainStatus: 'processed' },
        $currentDate: { updatedAt: true },
      }
    );
    return result.modifiedCount;
  });
}

/**
 * 5. Backfill Campaign.totalRaisedWei from numeric currentRaised for non-blockchain campaigns.
 *    Estimate: 1 POL = 1e18 wei for numeric values stored in web3 campaigns.
 *    For INR campaigns (currency='INR'), skip — no wei conversion possible.
 */
async function backfillCampaignTotalRaisedWei() {
  return migrate('Backfill Campaign.totalRaisedWei from currentRaised (POL campaigns only)', async () => {
    const campaigns = await Campaign.find({
      currentRaised: { $gt: 0 },
      totalRaisedWei: { $in: [null, undefined, '0', ''] },
      currency: 'POL',
    }).select('currentRaised currency').lean();

    if (campaigns.length === 0) {
      info('No campaigns need totalRaisedWei backfill — skip');
      return 0;
    }

    let modified = 0;
    for (const campaign of campaigns) {
      const estimatedWei = (BigInt(Math.round(campaign.currentRaised * 1e9)) * BigInt(1e9)).toString();
      await Campaign.updateOne(
        { _id: campaign._id },
        { $set: { totalRaisedWei: estimatedWei } }
      );
      modified++;
    }
    return modified;
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function runMigrations() {
  const MONGO_URI = process.env.MONGO_URI;
  if (!MONGO_URI) {
    console.error('❌ MONGO_URI not set. Cannot run migrations.');
    process.exit(1);
  }

  console.log('\n══════════════════════════════════════════════════════════════');
  console.log(`  Enigma — Phase 12 Database Migration ${DRY_RUN ? '[DRY-RUN]' : '[LIVE]'}`);
  console.log('══════════════════════════════════════════════════════════════\n');

  if (DRY_RUN) {
    console.log('  ℹ️  DRY-RUN MODE: No writes will be performed.\n');
  }

  await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 10_000 });
  console.log('  ✅ Connected to MongoDB\n');

  const results = [];

  results.push(await migrateLegacyStatusField());
  results.push(await migrateLegacyBlockchainStatusField());
  results.push(await migrateRazorpayInvestments());
  results.push(await fixNullEvidenceBundleStatus());
  results.push(await backfillCampaignTotalRaisedWei());

  const totalModified = results.reduce((a, b) => a + b, 0);

  console.log('\n══════════════════════════════════════════════════════════════');
  console.log(`  Migration complete — ${totalModified} document(s) modified`);
  if (DRY_RUN) console.log('  ⚠️  DRY-RUN: no actual changes were made');
  console.log('══════════════════════════════════════════════════════════════\n');

  await mongoose.disconnect();
  process.exit(0);
}

runMigrations().catch((err) => {
  console.error('\n❌ Migration failed:', err);
  process.exit(1);
});
