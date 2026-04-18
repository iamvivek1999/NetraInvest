/**
 * src/services/razorpay.service.js
 *
 * Handles Razorpay API interactions for creating orders and verifying payment signatures.
 */

const Razorpay = require('razorpay');
const crypto = require('crypto');
const env = require('../config/env');

class RazorpayService {
  constructor() {
    // Only initialize if keys are present (prevents startup crash if not configured but not immediately needed)
    this.razorpay = null;
    
    if (env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET) {
      this.razorpay = new Razorpay({
        key_id: env.RAZORPAY_KEY_ID,
        key_secret: env.RAZORPAY_KEY_SECRET,
      });
    }
  }

  /**
   * Generates a new order securely hitting Razorpay endpoints natively
   * @param {Object} params
   * @param {number} params.amount Amount in primary currency unit (will be converted to Paise internally, but typically Razorpay expects Paise; we will assume caller passes paise or generic equivalent)
   * @param {string} params.currency Defaults to INR
   * @param {string} params.receipt Custom identifying receipt note
   * @returns {Promise<Object>} Razorpay Order Object
   */
  async createRazorpayOrder({ amountPaise, currency = 'INR', receipt, notes = {} }) {
    if (!this.razorpay) {
      throw new Error('Razorpay is not configured on this server correctly.');
    }

    const options = {
      amount: amountPaise,
      currency,
      receipt,
      notes,
    };

    return await this.razorpay.orders.create(options);
  }

  /**
   * Verifies an arbitrary Razorpay generated HMAC signature
   * @param {Object} params
   * @param {string} params.razorpayOrderId
   * @param {string} params.razorpayPaymentId
   * @param {string} params.razorpaySignature
   * @returns {boolean} True if matched
   */
  verifyRazorpaySignature({ razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
    if (!env.RAZORPAY_KEY_SECRET) {
      throw new Error('RAZORPAY_KEY_SECRET not configured');
    }

    const body = razorpayOrderId + '|' + razorpayPaymentId;
    const expectedSignature = crypto
      .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    return expectedSignature === razorpaySignature;
  }
}

module.exports = new RazorpayService();
