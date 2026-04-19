/**
 * src/services/evidenceProcessor.service.js
 *
 * Pipeline that runs after multer delivers file buffers:
 *
 *   validateFiles()
 *     → hash each buffer (SHA-256)
 *     → save to local storage
 *   extractTextData()
 *     → parse CSV rows, read TXT/JSON content
 *     → images and PDFs get a placeholder (no local OCR dependency)
 *   normaliseSummary()
 *     → build a deterministic summary object
 *   saveArtifacts()
 *     → write extracted.json, summary.json, metadata.json to bundle dir
 *   computeFinalHashes()
 *     → bundleHash (keccak256 of sorted file hashes) → evidenceHash on-chain
 *     → summaryHash (keccak256 of summary JSON)       → on-chain
 *
 * Returns:
 *   {
 *     evidenceFiles:   [{ originalName, savedName, relativePath, mimeType, sizeBytes, fileHash }]
 *     extractedData:   { ... }   (normalised fields from documents)
 *     summaryJson:     { ... }   (human-readable summary, hashed)
 *     evidenceHash:    "0x..."   (keccak256 of bundle — goes on-chain)
 *     summaryHash:     "0x..."   (keccak256 of summaryJson — goes on-chain)
 *     extractedPath:   "milestones/.../extracted.json"
 *     summaryPath:     "milestones/.../summary.json"
 *     metadataPath:    "milestones/.../metadata.json"
 *     storageBackend:  "local"
 *     processedAt:     Date
 *   }
 *
 * MIGRATION NOTE:
 *   In this phase, files are stored locally.
 *   When migrating to IPFS/S3:
 *   1. Replace saveFile() calls with upload-to-remote + get CID/URL
 *   2. Keep hash computation IDENTICAL — it doesn't depend on storage location
 *   3. Update storageBackend field to 'ipfs' or 's3'
 *   4. No changes required in controllers or models
 */

'use strict';

const path     = require('path');
const papa     = require('papaparse');  // CSV parsing
const storage  = require('./evidenceStorage.service');
const {
  hashFileBuffer,
  computeBundleHash,
  hashSummaryJson,
} = require('../utils/hash.util');

// ─── MIME → category mapping ──────────────────────────────────────────────────

const MIME_CATEGORY = {
  'application/pdf':                                                             'pdf',
  'image/png':                                                                   'image',
  'image/jpeg':                                                                  'image',
  'image/webp':                                                                  'image',
  'text/csv':                                                                    'csv',
  'application/csv':                                                             'csv',
  'text/x-csv':                                                                  'csv',
  'application/vnd.ms-excel':                                                    'spreadsheet',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':          'spreadsheet',
  'application/msword':                                                          'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':    'doc',
  'application/json':                                                            'json',
  'text/plain':                                                                  'text',
};

// ─── Main Pipeline ────────────────────────────────────────────────────────────

/**
 * Process an array of uploaded files for a milestone.
 *
 * @param {object} params
 * @param {string}   params.campaignKey       bytes32 key from contract
 * @param {number}   params.milestoneIndex    0-based milestone number
 * @param {object[]} params.files             multer file objects (memoryStorage)
 *                   each: { originalname, mimetype, buffer, size }
 * @param {object}   params.meta              optional meta from request body
 *                   { title, description, submittedBy }
 * @returns {Promise<ProcessedBundle>}
 */
async function processEvidenceFiles({ campaignKey, milestoneIndex, files, meta = {} }) {
  if (!files || files.length === 0) {
    throw new Error('EvidenceProcessor: no files provided');
  }

  // ── Step 1: Hash + save each file ─────────────────────────────────────────

  const evidenceFiles = [];

  for (let i = 0; i < files.length; i++) {
    const f      = files[i];
    const buffer = f.buffer;

    // Compute SHA-256 hash before any I/O — ensures hash matches stored content
    const fileHash = hashFileBuffer(buffer);

    // Save to disk (local storage)
    const saved = storage.saveFile(
      campaignKey, milestoneIndex, i, f.originalname, buffer
    );

    evidenceFiles.push({
      originalName:  f.originalname,
      savedName:     saved.savedName,
      relativePath:  saved.relativePath,    // ← what goes in MongoDB
      mimeType:      f.mimetype,
      category:      MIME_CATEGORY[f.mimetype] || 'other',
      sizeBytes:     f.size,
      fileHash,                              // SHA-256 hex (no 0x)
    });
  }

  // ── Step 2: Extract text / data from each file ────────────────────────────

  const extractedData = await extractFromFiles(evidenceFiles, files);

  // ── Step 3: Build deterministic summary ──────────────────────────────────

  const summaryJson = buildSummary({
    campaignKey,
    milestoneIndex,
    evidenceFiles,
    extractedData,
    meta,
  });

  // ── Step 4: Compute canonical hashes ─────────────────────────────────────

  const fileHashes  = evidenceFiles.map(f => f.fileHash);
  const evidenceHash = computeBundleHash(fileHashes);
  const summaryHash  = hashSummaryJson(summaryJson);

  // ── Step 5: Write JSON artefacts to bundle directory ─────────────────────

  const processedAt = new Date();

  const { relativePath: extractedPath } = storage.writeBundleJson(
    campaignKey, milestoneIndex, 'extracted.json', extractedData
  );

  const { relativePath: summaryPath } = storage.writeBundleJson(
    campaignKey, milestoneIndex, 'summary.json', summaryJson
  );

  const metadataObj = buildMetadata({
    campaignKey,
    milestoneIndex,
    evidenceFiles,
    evidenceHash,
    summaryHash,
    storageBackend: storage.getStorageBackend(),
    processedAt,
    meta,
  });

  const { relativePath: metadataPath } = storage.writeBundleJson(
    campaignKey, milestoneIndex, 'metadata.json', metadataObj
  );

  // ── Return ────────────────────────────────────────────────────────────────

  return {
    evidenceFiles,
    extractedData,
    summaryJson,
    evidenceHash,
    summaryHash,
    extractedPath,
    summaryPath,
    metadataPath,
    storageBackend: storage.getStorageBackend(),
    processedAt,
  };
}

// ─── Extraction ───────────────────────────────────────────────────────────────

/**
 * Extract readable data from each uploaded file.
 * Returns a merged extractedData object.
 */
async function extractFromFiles(evidenceFiles, multerFiles) {
  const extracted = {
    textContent:  [],   // from txt/plain files
    csvRows:      [],   // from CSV files (array of row objects)
    jsonContent:  [],   // from JSON files
    pdfSummary:   [],   // placeholder per PDF (text extraction requires external dep)
    imageCount:   0,    // images cannot be extracted locally without OCR
    docCount:     0,    // Word docs — full extraction requires libreoffice/mammoth
  };

  for (let i = 0; i < evidenceFiles.length; i++) {
    const ef  = evidenceFiles[i];
    const buf = multerFiles[i].buffer;

    switch (ef.category) {
      case 'text': {
        const text = buf.toString('utf8').trim();
        if (text) {
          extracted.textContent.push({ file: ef.originalName, text: text.slice(0, 5000) });
        }
        break;
      }

      case 'json': {
        try {
          const parsed = JSON.parse(buf.toString('utf8'));
          extracted.jsonContent.push({ file: ef.originalName, data: parsed });
        } catch {
          extracted.textContent.push({ file: ef.originalName, text: buf.toString('utf8').slice(0, 1000) });
        }
        break;
      }

      case 'csv': {
        const csvStr = buf.toString('utf8');
        const result = papa.parse(csvStr, {
          header:         true,
          skipEmptyLines: true,
          dynamicTyping:  true,
        });
        if (result.data && result.data.length > 0) {
          extracted.csvRows.push({
            file:    ef.originalName,
            columns: result.meta.fields || [],
            rows:    result.data.slice(0, 200), // cap at 200 rows to avoid huge payloads
            total:   result.data.length,
          });
        }
        break;
      }

      case 'pdf': {
        // Full PDF text extraction requires pdf-parse or pdfjs-dist (heavy deps).
        // Placeholder: record file presence + hash for anchoring purposes.
        // TODO: integrate pdf-parse when text extraction is needed.
        extracted.pdfSummary.push({
          file:  ef.originalName,
          note:  'PDF text extraction requires pdf-parse integration (future milestone)',
          hash:  ef.fileHash,
        });
        break;
      }

      case 'spreadsheet': {
        // XLSX requires 'xlsx' (SheetJS) package — not yet installed.
        // Record as placeholder; install 'xlsx' when spreadsheet parsing is needed.
        extracted.docCount += 1;
        break;
      }

      case 'image': {
        extracted.imageCount += 1;
        break;
      }

      case 'doc': {
        extracted.docCount += 1;
        break;
      }

      default:
        break;
    }
  }

  return extracted;
}

// ─── Summary Builder ──────────────────────────────────────────────────────────

/**
 * Build a deterministic summary JSON.
 * Keys are stable — do NOT add timestamp or random fields here.
 * The summaryHash is derived from this object; it must be reproducible.
 */
function buildSummary({ campaignKey, milestoneIndex, evidenceFiles, extractedData, meta }) {
  return {
    campaignKey,
    milestoneIndex: Number(milestoneIndex),
    submittedBy:    meta.submittedBy   || null,
    title:          meta.title         || null,
    description:    meta.description   || null,
    fileCount:      evidenceFiles.length,
    files: evidenceFiles.map(f => ({
      name:     f.originalName,
      type:     f.category,
      mimeType: f.mimeType,
      size:     f.sizeBytes,
      hash:     f.fileHash,         // SHA-256, no 0x
    })),
    csvSummary: extractedData.csvRows.map(r => ({
      file:    r.file,
      columns: r.columns,
      total:   r.total,
    })),
    textSnippets: extractedData.textContent.map(t => ({
      file:    t.file,
      preview: t.text.slice(0, 300),
    })),
    imageCount:  extractedData.imageCount,
    docCount:    extractedData.docCount,
    pdfCount:    extractedData.pdfSummary.length,
    jsonObjects: extractedData.jsonContent.length,
  };
}

// ─── Metadata Builder ─────────────────────────────────────────────────────────

/**
 * Build the metadata.json written to the bundle directory.
 * This is for human readability / debugging, not hashed.
 */
function buildMetadata({
  campaignKey, milestoneIndex, evidenceFiles,
  evidenceHash, summaryHash,
  storageBackend, processedAt, meta,
}) {
  return {
    schema:          'enigma-evidence-bundle-v1',
    storageBackend,
    migrationNote:   'To move to IPFS/S3: upload files, store CIDs, keep hashes identical.',
    campaignKey,
    milestoneIndex:  Number(milestoneIndex),
    processedAt:     processedAt.toISOString(),
    submittedBy:     meta.submittedBy || null,
    evidenceHash,    // 0x-prefixed keccak256 — submit to contract
    summaryHash,     // 0x-prefixed keccak256 — submit to contract
    files: evidenceFiles.map(f => ({
      originalName: f.originalName,
      savedName:    f.savedName,
      relativePath: f.relativePath,
      sizeBytes:    f.sizeBytes,
      fileHash:     f.fileHash,
    })),
  };
}

module.exports = {
  processEvidenceFiles,
};
