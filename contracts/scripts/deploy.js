/**
 * contracts/scripts/deploy.js
 *
 * Deployment script for InvestmentPlatform.sol
 *
 * Usage:
 *   npx hardhat run scripts/deploy.js --network hardhat    # local
 *   npx hardhat run scripts/deploy.js --network amoy       # Polygon Amoy testnet
 *
 * Environment variables (contracts/.env):
 *   ADMIN_PRIVATE_KEY     — deployer / DEFAULT_ADMIN_ROLE holder
 *   OPERATOR_PRIVATE_KEY  — granted OPERATOR_ROLE (evidence anchoring)
 *   REVIEWER_PRIVATE_KEY  — granted REVIEWER_ROLE (milestone approval & release)
 *
 * After deployment, this script will:
 *   1. Deploy the contract
 *   2. Grant OPERATOR_ROLE if OPERATOR_ADDRESS / OPERATOR_PRIVATE_KEY is set
 *   3. Grant REVIEWER_ROLE if REVIEWER_ADDRESS / REVIEWER_PRIVATE_KEY is set
 *   4. Print all addresses and the new CONTRACT_ADDRESS for .env update
 */

'use strict';

require('dotenv').config();

const { ethers } = require('hardhat');

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log('\n══════════════════════════════════════════════════════');
  console.log('  Enigma InvestmentPlatform — Contract Deployment');
  console.log('══════════════════════════════════════════════════════\n');
  console.log(`  Network:  ${(await ethers.provider.getNetwork()).name}`);
  console.log(`  Deployer: ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`  Balance:  ${ethers.formatEther(balance)} ETH/POL\n`);

  // ─── 1. Deploy ──────────────────────────────────────────────────────────────
  console.log('  ► Deploying InvestmentPlatform...');
  const Factory = await ethers.getContractFactory('InvestmentPlatform', deployer);
  const contract = await Factory.deploy();
  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();
  console.log(`  ✅ Deployed at: ${contractAddress}\n`);

  // ─── Role bytes32 identifiers ───────────────────────────────────────────────
  const OPERATOR_ROLE = ethers.id('OPERATOR_ROLE');
  const REVIEWER_ROLE = ethers.id('REVIEWER_ROLE');

  // ─── 2. Grant OPERATOR_ROLE ─────────────────────────────────────────────────
  let operatorAddress = process.env.OPERATOR_ADDRESS || null;

  // If no explicit OPERATOR_ADDRESS, try to derive from OPERATOR_PRIVATE_KEY
  if (!operatorAddress && process.env.OPERATOR_PRIVATE_KEY) {
    const opWallet = new ethers.Wallet(process.env.OPERATOR_PRIVATE_KEY);
    operatorAddress = opWallet.address;
  }

  if (operatorAddress) {
    console.log(`  ► Granting OPERATOR_ROLE to ${operatorAddress}...`);
    const tx = await contract.grantRole(OPERATOR_ROLE, operatorAddress);
    await tx.wait(1);
    console.log(`  ✅ OPERATOR_ROLE granted (tx: ${tx.hash})\n`);
  } else {
    console.log('  ⚠️  OPERATOR_ADDRESS / OPERATOR_PRIVATE_KEY not set — OPERATOR_ROLE NOT granted');
    console.log('     Set either OPERATOR_ADDRESS or OPERATOR_PRIVATE_KEY in contracts/.env\n');
  }

  // ─── 3. Grant REVIEWER_ROLE ─────────────────────────────────────────────────
  let reviewerAddress = process.env.REVIEWER_ADDRESS || null;

  // If no explicit REVIEWER_ADDRESS, try to derive from REVIEWER_PRIVATE_KEY
  if (!reviewerAddress && process.env.REVIEWER_PRIVATE_KEY) {
    const revWallet = new ethers.Wallet(process.env.REVIEWER_PRIVATE_KEY);
    reviewerAddress = revWallet.address;
  }

  if (reviewerAddress) {
    console.log(`  ► Granting REVIEWER_ROLE to ${reviewerAddress}...`);
    const tx = await contract.grantRole(REVIEWER_ROLE, reviewerAddress);
    await tx.wait(1);
    console.log(`  ✅ REVIEWER_ROLE granted (tx: ${tx.hash})\n`);
  } else {
    console.log('  ⚠️  REVIEWER_ADDRESS / REVIEWER_PRIVATE_KEY not set — REVIEWER_ROLE NOT granted');
    console.log('     Admin wallet retains REVIEWER_ROLE by default (see contract constructor)\n');
  }

  // ─── 4. Print summary for .env update ──────────────────────────────────────
  console.log('══════════════════════════════════════════════════════');
  console.log('  DEPLOYMENT SUMMARY — update your .env files');
  console.log('══════════════════════════════════════════════════════\n');
  console.log('  # Add the following to backend/.env/.env and contracts/.env:\n');
  console.log(`  CONTRACT_ADDRESS=${contractAddress}`);
  if (operatorAddress)  console.log(`  # OPERATOR wallet: ${operatorAddress}`);
  if (reviewerAddress)  console.log(`  # REVIEWER wallet: ${reviewerAddress}`);
  console.log('');
  console.log('  # Then run in backend/:');
  console.log('  npm run sync:abi');
  console.log('══════════════════════════════════════════════════════\n');

  // ─── 5. Verify roles ────────────────────────────────────────────────────────
  const DEFAULT_ADMIN_ROLE = ethers.ZeroHash;
  console.log('  ► Role verification:');
  console.log(`     Admin     (${deployer.address}): ${await contract.hasRole(DEFAULT_ADMIN_ROLE, deployer.address) ? '✅' : '❌'} DEFAULT_ADMIN_ROLE`);
  console.log(`     Admin     (${deployer.address}): ${await contract.hasRole(REVIEWER_ROLE, deployer.address) ? '✅' : '❌'} REVIEWER_ROLE (auto-granted in constructor)`);
  if (operatorAddress) console.log(`     Operator  (${operatorAddress}): ${await contract.hasRole(OPERATOR_ROLE, operatorAddress) ? '✅' : '❌'} OPERATOR_ROLE`);
  if (reviewerAddress) console.log(`     Reviewer  (${reviewerAddress}): ${await contract.hasRole(REVIEWER_ROLE, reviewerAddress) ? '✅' : '❌'} REVIEWER_ROLE`);
  console.log('');

  return contractAddress;
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Deployment failed:', err);
    process.exit(1);
  });
