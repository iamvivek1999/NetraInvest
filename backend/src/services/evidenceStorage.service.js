/**
 * src/services/evidenceStorage.service.js
 *
 * Storage abstraction layer for milestone evidence files.
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  ARCHITECTURE PRINCIPLE                                             │
 * │  This module is the ONLY place that knows where files live on disk. │
 * │  Controllers and the processor service use only the public API      │
 * │  (saveFile, readFile, deleteBundle, resolveServePath).              │
 * │                                                                     │
 * │  MIGRATION PATH                                                     │
 * │  To switch to S3/IPFS:                                              │
 * │   1. Replace the LOCAL_* constants and private helpers below        │
 * │   2. Keep the public API signature identical                        │
 * │   3. Update the storagePath format returned (e.g. "ipfs://<cid>")  │
 * │  No other file needs to change.                                     │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * Local folder structure:
 *   <STORAGE_ROOT>/milestones/<campaignKey>/<milestoneIndex>/
 *     files/             ← original uploaded files (immutable once written)
 *     extracted.json     ← normalised extracted data
 *     summary.json       ← human-readable summary object
 *     metadata.json      ← bundle metadata: hashes, timestamps, file list
 *
 * MongoDB stores ONLY relative paths (relative to STORAGE_ROOT).
 * Absolute paths are never exposed to the frontend.
 *
 * Environment variables:
 *   EVIDENCE_STORAGE_ROOT  — absolute path to storage root
 *                           defaults to <repo>/storage (created if absent)
 */

'use strict';

const path = require('path');
const fs   = require('fs');

// ─── Storage Root ─────────────────────────────────────────────────────────────

/**
 * Resolve the storage root from env or fall back to <backend>/../../storage.
 * The "../.." walk from backend/src/services → backend → root of the monorepo.
 */
const STORAGE_ROOT = process.env.EVIDENCE_STORAGE_ROOT
  ? path.resolve(process.env.EVIDENCE_STORAGE_ROOT)
  : path.resolve(__dirname, '..', '..', '..', 'storage');

// Ensure root exists on module load — harmless if already present
fs.mkdirSync(STORAGE_ROOT, { recursive: true });

// ─── Path Helpers ─────────────────────────────────────────────────────────────

/**
 * Build the absolute directory path for a specific milestone bundle.
 *
 * @param {string} campaignKey      hex bytes32 key (from contract)
 * @param {number|string} milestoneIndex  0-based index
 * @returns {string} absolute directory path
 */
function bundleDir(campaignKey, milestoneIndex) {
  // Sanitise key — only allow hex chars (0-9a-fA-F) and optional 0x prefix
  const safeKey = campaignKey.replace(/^0x/i, '').replace(/[^a-fA-F0-9]/g, '');
  const idx     = String(parseInt(milestoneIndex, 10));
  return path.join(STORAGE_ROOT, 'milestones', safeKey, idx);
}

/**
 * Convert an absolute path inside STORAGE_ROOT to a relative storage path.
 * These relative paths are what gets stored in MongoDB.
 *
 * @param {string} absolutePath
 * @returns {string}  e.g. "milestones/abc123/0/files/report.pdf"
 */
function toRelative(absolutePath) {
  return path.relative(STORAGE_ROOT, absolutePath).replace(/\\/g, '/');
}

/**
 * Convert a relative storage path back to an absolute path.
 * Used internally and in the file-serving endpoint.
 *
 * @param {string} relativePath  the value stored in MongoDB
 * @returns {string} absolute path
 */
function toAbsolute(relativePath) {
  // Guard: block path traversal
  const resolved = path.resolve(STORAGE_ROOT, relativePath);
  if (!resolved.startsWith(STORAGE_ROOT)) {
    throw new Error('EvidenceStorage: path traversal detected');
  }
  return resolved;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Ensure the directory tree exists for a milestone bundle.
 * Idempotent — safe to call multiple times.
 *
 * @param {string} campaignKey
 * @param {number} milestoneIndex
 * @returns {{ bundleDir: string, filesDir: string }}  absolute paths
 */
function ensureBundleDir(campaignKey, milestoneIndex) {
  const dir      = bundleDir(campaignKey, milestoneIndex);
  const filesDir = path.join(dir, 'files');
  fs.mkdirSync(filesDir, { recursive: true });
  return { bundleDir: dir, filesDir };
}

/**
 * Save an uploaded file buffer to the bundle's files/ directory.
 * Filename is sanitised and an index-prefix is added to avoid collisions
 * (e.g. "0_report.pdf", "1_financial.xlsx").
 *
 * @param {string}  campaignKey
 * @param {number}  milestoneIndex
 * @param {number}  fileOrder       0-based position within this upload batch
 * @param {string}  originalName    original filename from multipart upload
 * @param {Buffer}  buffer          file contents
 * @returns {{ relativePath: string, absolutePath: string, savedName: string }}
 */
function saveFile(campaignKey, milestoneIndex, fileOrder, originalName, buffer) {
  const { filesDir } = ensureBundleDir(campaignKey, milestoneIndex);

  // Sanitise filename: keep alphanumerics, dots, dashes, underscores only
  const safe    = path.basename(originalName).replace(/[^a-zA-Z0-9._-]/g, '_');
  const name    = `${fileOrder}_${safe}`;
  const absPath = path.join(filesDir, name);

  fs.writeFileSync(absPath, buffer);

  return {
    relativePath: toRelative(absPath),
    absolutePath: absPath,
    savedName:    name,
  };
}

/**
 * Write a JSON object to a named file in the bundle root (not files/).
 * Used for extracted.json, summary.json, metadata.json.
 *
 * @param {string} campaignKey
 * @param {number} milestoneIndex
 * @param {string} filename         e.g. 'summary.json'
 * @param {object} data             plain object (will be JSON.stringify'd)
 * @returns {{ relativePath: string, absolutePath: string }}
 */
function writeBundleJson(campaignKey, milestoneIndex, filename, data) {
  const { bundleDir: dir } = ensureBundleDir(campaignKey, milestoneIndex);
  const absPath = path.join(dir, filename);
  fs.writeFileSync(absPath, JSON.stringify(data, null, 2), 'utf8');
  return {
    relativePath: toRelative(absPath),
    absolutePath: absPath,
  };
}

/**
 * Read a file from local storage by its relative path.
 * Returns a Buffer. Throws if the file doesn't exist.
 *
 * @param {string} relativePath  value stored in MongoDB
 * @returns {Buffer}
 */
function readFile(relativePath) {
  const abs = toAbsolute(relativePath);
  if (!fs.existsSync(abs)) {
    const err = new Error(`EvidenceStorage: file not found — ${relativePath}`);
    err.code  = 'FILE_NOT_FOUND';
    throw err;
  }
  return fs.readFileSync(abs);
}

/**
 * Check whether a relative path exists in local storage.
 * Used before serving a file.
 *
 * @param {string} relativePath
 * @returns {boolean}
 */
function fileExists(relativePath) {
  try {
    const abs = toAbsolute(relativePath);
    return fs.existsSync(abs);
  } catch {
    return false;
  }
}

/**
 * Return metadata about a stored file (size, mtime).
 *
 * @param {string} relativePath
 * @returns {{ sizeBytes: number, modifiedAt: Date }}
 */
function fileStats(relativePath) {
  const abs   = toAbsolute(relativePath);
  const stats = fs.statSync(abs);
  return { sizeBytes: stats.size, modifiedAt: stats.mtime };
}

/**
 * Delete an entire milestone bundle directory and all its contents.
 * Use with caution — only for cleanup / cancel flows.
 *
 * @param {string} campaignKey
 * @param {number} milestoneIndex
 */
function deleteBundle(campaignKey, milestoneIndex) {
  const dir = bundleDir(campaignKey, milestoneIndex);
  fs.rmSync(dir, { recursive: true, force: true });
}

/**
 * Resolve the absolute path to serve a file to an authenticated client.
 * The controller calls this and pipes the file to the response.
 * Only relative paths from MongoDB are accepted — no user-supplied paths.
 *
 * @param {string} relativePath
 * @returns {string} absolute path
 */
function resolveServePath(relativePath) {
  return toAbsolute(relativePath); // includes path traversal guard
}

/**
 * Return the storage backend type identifier.
 * When migrating to IPFS/S3, change this return value and update callers.
 *
 * @returns {'local'|'ipfs'|'s3'}
 */
function getStorageBackend() {
  return 'local';
}

module.exports = {
  STORAGE_ROOT,
  ensureBundleDir,
  saveFile,
  writeBundleJson,
  readFile,
  fileExists,
  fileStats,
  deleteBundle,
  resolveServePath,
  getStorageBackend,
};
