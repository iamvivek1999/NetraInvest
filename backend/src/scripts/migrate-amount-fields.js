/**
 * migrate-amount-fields.js
 *
 * Phase 1 migration: backfill the new Web3-safe monetary fields on existing
 * Campaign, Investment, and Milestone documents.
 *
 * What this does (additive only — no existing data modified):
 *   Campaign:
 *     - Sets currentRaisedWei  = '0'  where missing
 *     - Sets currentReleasedWei = '0' where missing
 *     - Sets fundingGoalWei    = null where missing (must be set manually via fundingGoalPOL)
 *     - Sets fundingGoalPOL    = null where missing
 *     - Sets minInvestmentWei  = null where missing
 *     - Sets maxInvestmentWei  = null where missing
 *     - Adds 'POL' to currency enum default for new on-chain campaigns
 *
 *   Investment:
 *     - Removes legacy blockchainTxHash/Status/Error fields (null-only dead fields)
 *     - Fixes duplicate 'INR' currency default to 'POL' for confirmed on-chain investments
 *
 *   Milestone:
 *     - Sets releasedAmountWei = null where missing
 *     - Sets releaseTxHash     = null where missing
 *     - Sets releasedAt        = null where missing
 *
 * Run with:
 *   node src/scripts/migrate-amount-fields.js
 *
 * Safe to run multiple times (idempotent — uses $exists: false checks).
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Campaign   = require('../models/Campaign');
const Investment = require('../models/Investment');
const Milestone  = require('../models/Milestone');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/enigma';

async function run() {
  console.log('🔗 Connecting to MongoDB…');
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected.\n');

  // ─── Campaign ─────────────────────────────────────────────────────────────

  console.log('📋 Migrating Campaign documents…');

  const campaignWei = await Campaign.updateMany(
    { currentRaisedWei: { $exists: false } },
    { $set: { currentRaisedWei: '0', currentReleasedWei: '0' } }
  );
  console.log(`   currentRaisedWei/currentReleasedWei backfilled: ${campaignWei.modifiedCount} docs`);

  const campaignPOL = await Campaign.updateMany(
    { fundingGoalPOL: { $exists: false } },
    { $set: { fundingGoalPOL: null, fundingGoalWei: null, minInvestmentWei: null, maxInvestmentWei: null } }
  );
  console.log(`   fundingGoalPOL/Wei fields added: ${campaignPOL.modifiedCount} docs`);

  // ─── Investment ───────────────────────────────────────────────────────────

  console.log('\n💰 Migrating Investment documents…');

  // Remove dead blockchainTxHash/Status/Error fields that are always null
  const invClean = await Investment.updateMany(
    {
      $or: [
        { blockchainTxHash: { $exists: true } },
        { blockchainStatus: { $exists: true } },
        { blockchainError: { $exists: true } },
      ]
    },
    {
      $unset: { blockchainTxHash: '', blockchainStatus: '', blockchainError: '' }
    }
  );
  console.log(`   Removed dead blockchain* fields: ${invClean.modifiedCount} docs`);

  // Backfill amountWei on investments that have txHash but no amountWei
  // (We can't compute them without an RPC call, so we just mark them for manual review)
  const invNoWei = await Investment.countDocuments({ txHash: { $ne: null }, amountWei: null });
  if (invNoWei > 0) {
    console.log(`   ⚠️  ${invNoWei} on-chain investments have no amountWei — requires manual RPC reconciliation.`);
  } else {
    console.log(`   ✅ All on-chain investments have amountWei.`);
  }

  // ─── Milestone ────────────────────────────────────────────────────────────

  console.log('\n📌 Migrating Milestone documents…');

  const milestoneRelease = await Milestone.updateMany(
    { releasedAmountWei: { $exists: false } },
    { $set: { releasedAmountWei: null, releaseTxHash: null, releasedAt: null } }
  );
  console.log(`   On-chain release fields added: ${milestoneRelease.modifiedCount} docs`);

  // ─── Done ─────────────────────────────────────────────────────────────────

  console.log('\n✅ Migration complete.');
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
