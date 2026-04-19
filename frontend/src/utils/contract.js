/**
 * src/utils/contract.js
 *
 * Helpers for creating an ethers v6 contract instance connected to
 * the InvestmentPlatform smart contract on Polygon Amoy.
 *
 * Two variants:
 *   getReadContract()  — read-only, uses JsonRpcProvider (no wallet needed)
 *   getWriteContract() — read/write, needs a connected MetaMask signer
 *
 * Environment variables required:
 *   VITE_CONTRACT_ADDRESS  — deployed InvestmentPlatform address
 *   VITE_CHAIN_ID          — 80002 (Amoy) or 31337 (Hardhat)
 */

import { ethers }              from 'ethers';
import ABI                     from './abi/InvestmentPlatform.json';
import { CONTRACT_ADDRESS }    from './constants';

/**
 * Returns a read-only contract instance backed by the public Amoy RPC.
 * Safe to call without user interaction.
 */
export function getReadContract() {
  const provider = new ethers.JsonRpcProvider(
    'https://rpc-amoy.polygon.technology/'
  );
  return new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
}

/**
 * Returns a signer-backed contract instance.
 * Requires window.ethereum to be available and an account connected.
 *
 * @param {ethers.Signer} signer  — obtained from useWallet().getSigner()
 */
export function getWriteContract(signer) {
  if (!signer) throw new Error('A signer is required to create a write contract.');
  return new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
}

/**
 * Converts a POL decimal amount (human-readable string/number) to wei (BigInt).
 * e.g. toWei("1.5") → 1500000000000000000n
 *
 * @param {string|number} pol
 * @returns {bigint}
 */
export function toWei(pol) {
  return ethers.parseEther(String(pol));
}

/**
 * Converts wei (BigInt or string) to a human-readable POL decimal string.
 * e.g. fromWei("1500000000000000000") → "1.5"
 *
 * @param {bigint|string} wei
 * @returns {string}
 */
export function fromWei(wei) {
  return ethers.formatEther(wei);
}

// ─────────────────────────────────────────────────────────────────────────────
// All monetary conversion helpers live in src/utils/wei.js.
// Import toWei / fromWei from there for all on-chain amount operations.
// ─────────────────────────────────────────────────────────────────────────────
