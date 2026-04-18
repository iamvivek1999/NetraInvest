/**
 * src/scripts/syncAbi.js
 *
 * Copies the InvestmentPlatform ABI from the compiled Hardhat artifact
 * into the backend's config/abi directory.
 *
 * Run this once after every contract recompile:
 *   node src/scripts/syncAbi.js
 *   npm run sync:abi
 *
 * Source:  d:\Enigma\contracts\artifacts\contracts\InvestmentPlatform.sol\InvestmentPlatform.json
 * Dest:    d:\Enigma\backend\src\config\abi\InvestmentPlatform.json
 *
 * Only the ABI array is copied — not the full artifact (no bytecode bloat).
 */

const fs   = require('fs');
const path = require('path');

const ARTIFACT_PATH = path.resolve(
  __dirname,
  '../../..',         // up from backend/src/scripts → root (d:\Enigma)
  'contracts',
  'artifacts',
  'contracts',
  'InvestmentPlatform.sol',
  'InvestmentPlatform.json'
);

const DEST_DIR  = path.resolve(__dirname, '../config/abi');
const DEST_FILE = path.join(DEST_DIR, 'InvestmentPlatform.json');

if (!fs.existsSync(ARTIFACT_PATH)) {
  console.error('[syncAbi] Artifact not found at:', ARTIFACT_PATH);
  console.error('[syncAbi] Compile the contract first: cd ../contracts && npx hardhat compile');
  process.exit(1);
}

const artifact = JSON.parse(fs.readFileSync(ARTIFACT_PATH, 'utf8'));
fs.mkdirSync(DEST_DIR, { recursive: true });
fs.writeFileSync(DEST_FILE, JSON.stringify({ abi: artifact.abi }, null, 2));

console.log('[syncAbi] ABI synced successfully');
console.log('[syncAbi] Source:     ', ARTIFACT_PATH);
console.log('[syncAbi] Destination:', DEST_FILE);
console.log('[syncAbi] Functions:  ', artifact.abi.filter(x => x.type === 'function').map(x => x.name).join(', '));
