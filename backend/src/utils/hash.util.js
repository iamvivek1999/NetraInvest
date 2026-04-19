/**
 * src/utils/hash.util.js
 *
 * Deterministic hashing utilities for milestone evidence.
 *
 * Design goals:
 *  1. STABLE — same inputs always produce the same hash (no timestamps, no random)
 *  2. PORTABLE — the same algorithm can be reproduced from any IPFS/S3
 *     path later; the hash depends only on file content, never on storage path
 *  3. CONTRACT-COMPATIBLE — final evidence hash is keccak256 (same algo the
 *     smart contract uses internally), making cross-verification trivial
 *
 * Hash types produced:
 *  - fileHash      → SHA-256 of raw file buffer (hex string)  — per file
 *  - bundleHash    → keccak256 of sorted, concatenated fileHashes — canonical
 *  - summaryHash   → keccak256 of deterministically serialised summary JSON
 *
 * Migration note:
 *  When files move to IPFS/S3, the fileHash is still computed locally
 *  before upload so the bundleHash remains identical.
 */

'use strict';

const crypto    = require('crypto');
const { ethers } = require('ethers');

// ─── Constants ────────────────────────────────────────────────────────────────

const HEX_PREFIX = '0x';

// ─── Per-File Hash ────────────────────────────────────────────────────────────

/**
 * Compute SHA-256 hash of a file buffer.
 * Returns a 64-character lowercase hex string (no 0x prefix).
 *
 * @param {Buffer} buffer  file contents
 * @returns {string}       hex-encoded SHA-256 digest
 */
function hashFileBuffer(buffer) {
  if (!Buffer.isBuffer(buffer)) {
    throw new TypeError('hashFileBuffer: input must be a Buffer');
  }
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

// ─── Canonical Bundle Hash ────────────────────────────────────────────────────

/**
 * Compute a canonical bundle hash from an array of per-file SHA-256 hashes.
 *
 * Algorithm:
 *  1. Sort the fileHash strings lexicographically (so order of upload doesn't matter)
 *  2. Concatenate them into one UTF-8 string: "hash1|hash2|..."
 *  3. Compute keccak256 of that string (matching what the smart contract uses)
 *
 * The keccak256 is returned as a 0x-prefixed 32-byte hex string, ready to be
 * submitted to contract.submitMilestoneEvidenceHash(campaignKey, index, evidenceHash, summaryHash).
 *
 * @param {string[]} fileHashes  array of SHA-256 hex strings (no 0x prefix)
 * @returns {string}             keccak256 as 0x-prefixed 32-byte hex
 */
function computeBundleHash(fileHashes) {
  if (!Array.isArray(fileHashes) || fileHashes.length === 0) {
    throw new Error('computeBundleHash: fileHashes must be a non-empty array');
  }
  // Sort for determinism — upload order is irrelevant
  const sorted = [...fileHashes].sort();
  const joined = sorted.join('|');
  return ethers.keccak256(ethers.toUtf8Bytes(joined));
}

// ─── Summary Hash ─────────────────────────────────────────────────────────────

/**
 * Compute a deterministic hash of a JSON summary object.
 *
 * The summary is serialised using a stable key-sorted stringify so that field
 * insertion order differences don't change the hash.
 *
 * @param {object} summaryObj  normalised summary JSON (plain object)
 * @returns {string}           keccak256 as 0x-prefixed 32-byte hex
 */
function hashSummaryJson(summaryObj) {
  if (typeof summaryObj !== 'object' || summaryObj === null) {
    throw new TypeError('hashSummaryJson: input must be a non-null object');
  }
  const stable = stableSerialise(summaryObj);
  return ethers.keccak256(ethers.toUtf8Bytes(stable));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Deterministic JSON serialisation — keys are sorted recursively so the output
 * is identical regardless of object property insertion order.
 *
 * @param {*} value  any JSON-serialisable value
 * @returns {string} deterministic JSON string
 */
function stableSerialise(value) {
  if (Array.isArray(value)) {
    return '[' + value.map(stableSerialise).join(',') + ']';
  }
  if (value !== null && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    const pairs = keys.map(k => JSON.stringify(k) + ':' + stableSerialise(value[k]));
    return '{' + pairs.join(',') + '}';
  }
  return JSON.stringify(value);
}

/**
 * Friendly display: strip 0x prefix for logging without breaking 0x functions.
 * @param {string} hash  0x-prefixed keccak256
 * @returns {string}     shortened "0x1234…abcd" for display
 */
function shortHash(hash) {
  if (!hash || hash.length < 10) return hash;
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}

module.exports = {
  hashFileBuffer,
  computeBundleHash,
  hashSummaryJson,
  stableSerialise,
  shortHash,
};
