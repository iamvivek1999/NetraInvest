/**
 * src/routes/payment.routes.js
 *
 * Routes for Razorpay payment integration.
 */

const express = require('express');
const { body } = require('express-validator');
const { protect } = require('../middleware/auth');
const validateRequest = require('../middleware/validateRequest');
const paymentController = require('../controllers/payment.controller');

const router = express.Router();

// UPDATED FOR RAZORPAY PAYMENT FLOW

/**
 * @route   POST /api/v1/payments/create-order
 * @desc    Creates a Razorpay order before frontend checkout
 * @access  Private
 */
router.post(
  '/create-order',
  protect,
  [
    body('campaignId').isMongoId().withMessage('Valid Campaign ID is required'),
    body('amount').isNumeric().withMessage('Amount must be a valid number'),
  ],
  validateRequest,
  paymentController.createOrder
);

/**
 * @route   POST /api/v1/payments/verify
 * @desc    Verifies Razorpay payment signature & records the investment
 * @access  Private
 */
router.post(
  '/verify',
  protect,
  [
    body('campaignId').isMongoId().withMessage('Valid Campaign ID is required'),
    body('amount').isNumeric().withMessage('Amount is required'),
    body('razorpay_order_id').notEmpty().withMessage('razorpay_order_id is required'),
    body('razorpay_payment_id').notEmpty().withMessage('razorpay_payment_id is required'),
    body('razorpay_signature').notEmpty().withMessage('razorpay_signature is required'),
  ],
  validateRequest,
  paymentController.verifyPayment
);

module.exports = router;
