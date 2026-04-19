/**
 * src/scripts/syncEvents.js
 *
 * CLI utility to manually trigger blockchain event synchronization for a specific range.
 * 
 * Usage:
 *   node src/scripts/syncEvents.js <fromBlock> <toBlock>
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { getReadContract } = require('../config/blockchain');
const { secureProcessEvent } = require('../services/blockchainSync.service');

async function run() {
  const args = process.argv.slice(2);
  const fromBlock = parseInt(args[0]);
  const toBlock = parseInt(args[1]);

  if (isNaN(fromBlock) || isNaN(toBlock)) {
    console.error('Usage: node src/scripts/syncEvents.js <fromBlock> <toBlock>');
    process.exit(1);
  }

  try {
    console.log(`Connecting to MongoDB: ${process.env.MONGODB_URI}`);
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected.');

    console.log(`Fetching events from ${fromBlock} to ${toBlock}...`);
    const contract = getReadContract();
    const events = await contract.queryFilter('*', fromBlock, toBlock);
    
    console.log(`Found ${events.length} events. Starting sync...`);

    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      process.stdout.write(`[${i + 1}/${events.length}] Processing ${event.fragment?.name || 'Unknown'} at block ${event.blockNumber}... `);
      
      try {
        await secureProcessEvent(event);
        console.log('✅');
      } catch (err) {
        console.log(`❌ ERROR: ${err.message}`);
      }
    }

    console.log('\nSync completed.');
    process.exit(0);
  } catch (error) {
    console.error('Fatal error during sync script:', error);
    process.exit(1);
  }
}

run();
