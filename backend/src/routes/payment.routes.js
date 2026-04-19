/**
 * src/routes/payment.routes.js
 *
 * DEPRECATED — Razorpay off-chain payment flow has been retired.
 *
 * This route now returns HTTP 410 Gone on all endpoints.
 * It was previously mounted at /api/v1/payments-legacy.
 *
 * Migrate to:
 *   POST /api/v1/investments  — on-chain investment with txHash verification
 *
 * Original file archived at: src/_deprecated/payment.controller.js
 */

'use strict';

const express = require('express');
const router = express.Router();

const GONE_RESPONSE = {
  success: false,
  status: 410,
  message:
    'The Razorpay off-chain payment flow has been permanently retired. ' +
    'Please use the on-chain investment flow: POST /api/v1/investments with a verified txHash.',
  replacement: {
    endpoint: 'POST /api/v1/investments',
    docs: 'Submit your invest() transaction via MetaMask, await tx.wait(), then POST the txHash here.',
  },
};

// Return 410 Gone on all methods and sub-paths
router.all('*', (req, res) => {
  res.set('Deprecation', 'true');
  res.set('Sunset', 'Sat, 01 Jan 2026 00:00:00 GMT');
  res.set('Link', '</api/v1/investments>; rel="successor-version"');
  return res.status(410).json(GONE_RESPONSE);
});

module.exports = router;
