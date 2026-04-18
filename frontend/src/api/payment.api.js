/**
 * src/api/payment.api.js
 *
 * Payment API — POST /api/v1/payments/create-order and /verify
 */

import client from './client';

/**
 * Create a new Razorpay order securely targeting boundaries natively.
 * @param {Object} payload 
 * @param {string} payload.campaignId
 * @param {number} payload.amount
 */
export const createRazorpayOrder = async (payload) => {
  const { data } = await client.post('/payments/create-order', payload);
  // Returns { orderId, amount, currency } inside data.data typically
  return data.data;
};

/**
 * Verifies Razorpay payment signature and records investment locally mapping
 * @param {Object} payload
 * @param {string} payload.campaignId
 * @param {number} payload.amount
 * @param {string} payload.razorpay_order_id
 * @param {string} payload.razorpay_payment_id
 * @param {string} payload.razorpay_signature
 */
export const verifyRazorpayPayment = async (payload) => {
  const { data } = await client.post('/payments/verify', payload);
  return data.data;
};
