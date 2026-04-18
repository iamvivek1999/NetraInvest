/**
 * src/middleware/errorHandler.js
 *
 * Global error handling middleware.
 * Must be registered LAST in app.js (after all routes).
 *
 * Catches:
 *  - Mongoose validation errors     → 400
 *  - Mongoose duplicate key errors  → 409
 *  - Mongoose cast errors (bad ID)  → 400
 *  - JWT errors                     → 401
 *  - Custom ApiError instances      → respective status
 *  - Unhandled errors               → 500
 */

const env = require('../config/env');

// ─── Custom Error Class ──────────────────────────────────────────────────────

class ApiError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    // Capture stack trace, excluding constructor call
    Error.captureStackTrace(this, this.constructor);
  }
}

// ─── Error Handler Middleware ────────────────────────────────────────────────

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  error.statusCode = err.statusCode || 500;

  // ── Mongoose: bad ObjectId ──────────────────────────────────────────────
  if (err.name === 'CastError') {
    error.message = `Resource not found: invalid ID format`;
    error.statusCode = 400;
  }

  // ── Mongoose: duplicate key ─────────────────────────────────────────────
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {}).join(', ');
    error.message = `Duplicate value for: ${field}. This value is already in use.`;
    error.statusCode = 409;
  }

  // ── Mongoose: validation error ──────────────────────────────────────────
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    error.message = messages.join('. ');
    error.statusCode = 400;
  }

  // ── JWT: invalid signature ──────────────────────────────────────────────
  if (err.name === 'JsonWebTokenError') {
    error.message = 'Invalid token. Please log in again.';
    error.statusCode = 401;
  }

  // ── JWT: expired ────────────────────────────────────────────────────────
  if (err.name === 'TokenExpiredError') {
    error.message = 'Token expired. Please log in again.';
    error.statusCode = 401;
  }

  // Log in development only — avoid leaking details in production
  if (env.isDev) {
    console.error(`[ERROR] ${error.statusCode} — ${error.message}`.red);
    if (error.statusCode === 500) {
      console.error(err.stack);
    }
  }

  res.status(error.statusCode).json({
    success: false,
    message: error.message,
    // Stack only in development
    ...(env.isDev && error.statusCode === 500 && { stack: err.stack }),
  });
};

// ─── 404 Handler ─────────────────────────────────────────────────────────────

const notFound = (req, res, next) => {
  const error = new ApiError(`Route not found: ${req.method} ${req.originalUrl}`, 404);
  next(error);
};

module.exports = { errorHandler, notFound, ApiError };
