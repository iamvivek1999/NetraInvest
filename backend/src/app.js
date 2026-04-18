/**
 * src/app.js
 *
 * Express application factory.
 * Configures all middleware and registers routes.
 * Separated from server.js so the app can be tested without binding to a port.
 */

'use strict';

require('colors'); // enable colorized console output (used in db.js and error handler)
require('express-async-errors'); // patches Express to catch async errors automatically

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');

const env = require('./config/env');
const requestLogger = require('./middleware/requestLogger');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const routes = require('./routes/index');

const app = express();

// ─── Security Middleware ──────────────────────────────────────────────────────

// UPDATED FOR DEPLOYMENT PREP: 
// trust proxy = true (1) allows rate limiting to read the true client IP 
// when the server is sitting behind a load balancer (ALB, Nginx, Vercel, etc.)
app.set('trust proxy', 1);

// Set secure HTTP headers (Helmet)
// UPDATED FOR DEPLOYMENT PREP: Added custom CSP for Razorpay
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        // Allow scripts from 'self' and Razorpay
        'script-src': ["'self'", "'unsafe-inline'", 'https://checkout.razorpay.com'],
        // Allow frames from Razorpay
        'frame-src': ["'self'", 'https://checkout.razorpay.com'],
        // Allow connections to 'self' and Razorpay API
        'connect-src': ["'self'", 'https://api.razorpay.com'],
      },
    },
  })
);

// CORS — allow frontend origin
// UPDATED FOR DEPLOYMENT PREP: Strictly enforce env.FRONTEND_URL in production
const allowedOrigins = env.isDev
  ? [
    env.FRONTEND_URL,
    'http://localhost:5173', 'http://127.0.0.1:5173',
    'http://localhost:3000',
    'http://10.195.203.32',
    'http://10.195.203.32:3000',
    'http://10.195.203.32:5173',
  ]
  : [env.FRONTEND_URL];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps)
      if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.ngrok-free.app') || origin.endsWith('.loca.lt')) {
        callback(null, true);
      } else {
        // Log rejection in dev only to avoid log flooding in prod
        if (env.isDev) console.warn(`[CORS] Rejected origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning'],
  })
);

// Rate limiting — prevent brute force / abuse
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: env.isDev ? 500 : 200, // Be more lenient in dev, strict in prod
  message: {
    success: false,
    message: 'Too many requests from this IP. Please try again in 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// Sanitize MongoDB query injection (e.g. { $gt: '' } in body fields)
app.use(mongoSanitize());

// ─── Request Parsing ──────────────────────────────────────────────────────────

app.use(express.json({ limit: '10kb' }));           // parse JSON bodies
app.use(express.urlencoded({ extended: true, limit: '10kb' })); // parse form data

// ─── Logging ─────────────────────────────────────────────────────────────────

app.use(requestLogger);

// ─── API Routes ───────────────────────────────────────────────────────────────

app.use('/api/v1', routes);

// ─── 404 and Error Handlers ───────────────────────────────────────────────────
// These MUST come after all routes

app.use(notFound);
app.use(errorHandler);

module.exports = app;
