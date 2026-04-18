/**
 * src/middleware/requestLogger.js
 *
 * HTTP request logging via morgan.
 * Uses 'dev' format in development (colorized, concise).
 * Skips health check routes to keep logs clean.
 */

const morgan = require('morgan');
const env = require('../config/env');

const requestLogger = morgan(env.isDev ? 'dev' : 'combined', {
  skip: (req) => req.url === '/health', // suppress health check noise
});

module.exports = requestLogger;
