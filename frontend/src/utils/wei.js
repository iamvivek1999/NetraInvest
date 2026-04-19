/**
 * src/utils/wei.js
 *
 * Safe BigInt helpers for wei arithmetic on the frontend.
 *
 * All values crossing the API boundary are stored as strings to avoid
 * JavaScript's 53-bit integer precision limit. Never use regular Number
 * arithmetic for wei values — use the helpers in this file.
 *
 * Denomination guide:
 *   Wei  → the base unit (uint256 in the contract). Always stored/transmitted as a decimal string.
 *   POL  → human-readable decimal (1 POL = 1e18 wei). Used only for display.
 *   INR  → off-chain display target. Never used in contract logic.
 */

import { ethers } from 'ethers';

// ─── Conversion ───────────────────────────────────────────────────────────────

/**
 * Convert a POL decimal string/number to a wei string.
 * Safe for backend storage and BigInt arithmetic.
 *
 * @param {string|number} pol  e.g. "1.5" or 1.5
 * @returns {string}            e.g. "1500000000000000000"
 */
export const toWeiString = (pol) =>
  ethers.parseEther(String(pol)).toString();

/**
 * Convert a wei string to a POL decimal string (4 dp).
 * Use for display only — never feed this back into contract logic.
 *
 * @param {string|bigint} wei  e.g. "1500000000000000000"
 * @returns {string}            e.g. "1.5000"
 */
export const fromWeiString = (wei) => {
  if (!wei || wei === '0') return '0.0000';
  return parseFloat(ethers.formatEther(BigInt(wei))).toFixed(4);
};

// ─── Arithmetic ───────────────────────────────────────────────────────────────

/**
 * Add two wei strings safely via BigInt.
 *
 * @param {string} a  wei string
 * @param {string} b  wei string
 * @returns {string}  a + b as wei string
 */
export const addWei = (a, b) =>
  (BigInt(a || '0') + BigInt(b || '0')).toString();

/**
 * Subtract two wei strings safely via BigInt (clamps to 0).
 *
 * @param {string} a  wei string
 * @param {string} b  wei string
 * @returns {string}  max(a - b, 0) as wei string
 */
export const subtractWei = (a, b) => {
  const result = BigInt(a || '0') - BigInt(b || '0');
  return (result < 0n ? 0n : result).toString();
};

/**
 * Compare two wei strings.
 * @returns {-1 | 0 | 1}
 */
export const compareWei = (a, b) => {
  const ba = BigInt(a || '0');
  const bb = BigInt(b || '0');
  return ba < bb ? -1 : ba > bb ? 1 : 0;
};

// ─── Display Formatting ───────────────────────────────────────────────────────

/**
 * Format a wei string as a human-readable POL amount with unit label.
 * Returns "—" if value is null/undefined/empty.
 *
 * @param {string|null} wei
 * @param {number} [decimals=4]
 * @returns {string}  e.g. "1.5000 POL"
 */
export const formatPOL = (wei, decimals = 4) => {
  if (!wei || wei === '0' || wei === null) return '—';
  try {
    return `${parseFloat(ethers.formatEther(BigInt(wei))).toFixed(decimals)} POL`;
  } catch {
    return '—';
  }
};

/**
 * Compact POL display for large amounts (e.g. "1,500 POL").
 *
 * @param {string|null} wei
 * @returns {string}
 */
export const compactPOL = (wei) => {
  if (!wei || wei === '0' || wei === null) return '—';
  try {
    const pol = parseFloat(ethers.formatEther(BigInt(wei)));
    if (pol >= 1_000_000) return `${(pol / 1_000_000).toFixed(2)}M POL`;
    if (pol >= 1_000)     return `${(pol / 1_000).toFixed(2)}K POL`;
    return `${pol.toFixed(4)} POL`;
  } catch {
    return '—';
  }
};

/**
 * Completion percentage: how much of the funding goal has been raised.
 * Both arguments must be wei strings.
 *
 * @param {string} raisedWei
 * @param {string} goalWei
 * @returns {number}  0–100
 */
export const fundingPercent = (raisedWei, goalWei) => {
  if (!goalWei || goalWei === '0') return 0;
  try {
    const pct = (Number(BigInt(raisedWei || '0') * 10000n / BigInt(goalWei))) / 100;
    return Math.min(100, Math.max(0, pct));
  } catch {
    return 0;
  }
};
