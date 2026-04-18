/**
 * scripts/deploy.js
 *
 * Deployment script for InvestmentPlatform.sol.
 *
 * Local:  npx hardhat run scripts/deploy.js --network hardhat
 * Amoy:   npx hardhat run scripts/deploy.js --network amoy
 *
 * After deployment, copy the contract address to:
 *   backend/.env  →  CONTRACT_ADDRESS=0x...
 *
 * To verify on Polygonscan (Amoy):
 *   npx hardhat verify --network amoy <DEPLOYED_ADDRESS>
 */

const { ethers, network } = require('hardhat');

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log('─'.repeat(60));
  console.log('Deploying InvestmentPlatform');
  console.log('─'.repeat(60));
  console.log('Network:    ', network.name);
  console.log('Deployer:   ', deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('Balance:    ', ethers.formatEther(balance), 'MATIC');
  console.log('─'.repeat(60));

  // ── Deploy ────────────────────────────────────────────────────────────────
  const InvestmentPlatform = await ethers.getContractFactory('InvestmentPlatform');
  const contract = await InvestmentPlatform.deploy();

  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();
  const deployTx = contract.deploymentTransaction();

  console.log('\nDeployment successful!');
  console.log('─'.repeat(60));
  console.log('Contract address:', contractAddress);
  console.log('Deploy tx hash:  ', deployTx.hash);
  console.log('Owner (operator):', await contract.owner());

  if (network.name === 'amoy') {
    console.log('\nPolygonscan URL:');
    console.log(`https://amoy.polygonscan.com/address/${contractAddress}`);
    console.log('\nVerify with:');
    console.log(`npx hardhat verify --network amoy ${contractAddress}`);
  }

  console.log('\n─'.repeat(60));
  console.log('Add to backend/.env:');
  console.log(`CONTRACT_ADDRESS=${contractAddress}`);
  console.log('─'.repeat(60));
}

main().catch((error) => {
  console.error('\nDeployment failed:', error.message);
  process.exitCode = 1;
});
