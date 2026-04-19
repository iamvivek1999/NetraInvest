/**
 * src/middleware/upload.js
 *
 * Multer middleware for milestone evidence file uploads.
 *
 * Accepted MIME types / extensions:
 *   Documents:  pdf, doc, docx
 *   Images:     png, jpg, jpeg, webp
 *   Spreadsheets: csv, xls, xlsx
 *
 * Limits:
 *   - Max file size: 15 MB (per file)
 *   - Max 10 files per request
 *   - Files stored in process memory (memoryStorage) so the service can
 *     compute the hash before writing to disk
 *
 * Usage in a route:
 *   const { uploadEvidence } = require('../middleware/upload');
 *   router.post('/upload', protect, uploadEvidence, controller);
 */

'use strict';

const multer = require('multer');
const path   = require('path');

// ─── Allowed MIME Types ───────────────────────────────────────────────────────

const ALLOWED_MIME = new Set([
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  // Images
  'image/png',
  'image/jpeg',
  'image/webp',
  // Spreadsheets
  'text/csv',
  'application/csv',
  'text/x-csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  // JSON evidence bundles
  'application/json',
  'text/plain',   // .txt sometimes useful for logs
]);

const ALLOWED_EXT = new Set([
  '.pdf', '.doc', '.docx',
  '.png', '.jpg', '.jpeg', '.webp',
  '.csv', '.xls', '.xlsx',
  '.json', '.txt',
]);

// ─── Multer Config ────────────────────────────────────────────────────────────

const MAX_FILE_SIZE  = 15 * 1024 * 1024; // 15 MB
const MAX_FILE_COUNT = 10;

const upload = multer({
  storage: multer.memoryStorage(), // buffer in RAM so we can hash before saving

  limits: {
    fileSize:  MAX_FILE_SIZE,
    files:     MAX_FILE_COUNT,
  },

  fileFilter(_req, file, cb) {
    const ext      = path.extname(file.originalname).toLowerCase();
    const mimeOk   = ALLOWED_MIME.has(file.mimetype);
    const extOk    = ALLOWED_EXT.has(ext);

    if (mimeOk && extOk) {
      cb(null, true);
    } else {
      const err = new Error(
        `Unsupported file type: "${file.originalname}" (${file.mimetype}). ` +
        `Allowed: pdf, doc, docx, png, jpg, jpeg, webp, csv, xls, xlsx, json, txt`
      );
      err.code = 'UNSUPPORTED_FILE_TYPE';
      cb(err);
    }
  },
});

// ─── Named Middleware Exports ─────────────────────────────────────────────────

/**
 * uploadEvidence — accepts up to 10 files under the field name "files".
 * Rejects unsupported types / oversized files before the controller runs.
 */
const uploadEvidence = upload.array('files', MAX_FILE_COUNT);

/**
 * wrapMulterError — Express error handler that converts Multer-specific errors
 * into the standard API error shape expected by the frontend.
 * Mount this AFTER the route handler, not the standard errorHandler.
 */
function wrapMulterError(err, _req, res, next) {
  if (!err) return next();

  // Multer size / count limit
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      message: `File too large. Maximum size per file is ${MAX_FILE_SIZE / 1024 / 1024} MB.`,
    });
  }
  if (err.code === 'LIMIT_FILE_COUNT') {
    return res.status(413).json({
      success: false,
      message: `Too many files. Maximum ${MAX_FILE_COUNT} files per upload.`,
    });
  }
  if (err.code === 'UNSUPPORTED_FILE_TYPE') {
    return res.status(415).json({
      success: false,
      message: err.message,
    });
  }

  next(err); // pass to the global errorHandler
}

module.exports = {
  uploadEvidence,
  wrapMulterError,
  ALLOWED_MIME,
  ALLOWED_EXT,
  MAX_FILE_SIZE,
  MAX_FILE_COUNT,
};
