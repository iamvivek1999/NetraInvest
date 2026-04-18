/**
 * src/utils/notify.js
 *
 * Fire-and-forget notification helper.
 *
 * Usage:
 *   const notify = require('../utils/notify');
 *
 *   await notify(userId, 'investment_confirmed', 'Your ₹5,000 investment was confirmed.', {
 *     campaignId: campaign._id,
 *   });
 *
 * Errors are caught and logged — a notification failure should NEVER
 * crash the parent request (investment, milestone update, etc.).
 */

const Notification = require('../models/Notification');

/**
 * Create a notification document.
 *
 * @param {string|ObjectId} userId   - recipient user
 * @param {string}          type     - one of the enum values in Notification model
 * @param {string}          message  - human-readable, shown in bell dropdown
 * @param {object}          [meta]   - optional deep-link payload { campaignId?, milestoneId? }
 */
const notify = async (userId, type, message, meta = null) => {
  try {
    await Notification.create({ userId, type, message, meta });
  } catch (err) {
    // Non-fatal — log and continue. Parent operation should not fail.
    console.error(`[notify] Failed to create notification for user ${userId}:`, err.message);
  }
};

module.exports = notify;
