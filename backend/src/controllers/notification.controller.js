/**
 * src/controllers/notification.controller.js
 *
 * Notification endpoints.
 *
 *   GET  /api/v1/notifications          → paginated list for current user
 *   GET  /api/v1/notifications/unread-count → unread badge count
 *   PATCH /api/v1/notifications/:id/read  → mark single notification as read
 *   PATCH /api/v1/notifications/read-all  → mark all unread as read
 */

const Notification = require('../models/Notification');
const sendResponse = require('../utils/sendResponse');
const { ApiError } = require('../middleware/errorHandler');

// ─── GET /notifications ────────────────────────────────────────────────────────

/**
 * Returns paginated notifications for the current user, newest first.
 *
 * Query params:
 *   page  (default 1)
 *   limit (default 20, max 50)
 *   unreadOnly → 'true' to filter unread only
 */
const getNotifications = async (req, res) => {
  const { userId } = req.user;
  const { page = 1, limit = 20, unreadOnly } = req.query;

  const pageNum  = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
  const skip     = (pageNum - 1) * limitNum;

  const filter = { userId };
  if (unreadOnly === 'true') filter.isRead = false;

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ userId, isRead: false }),
  ]);

  sendResponse(res, 200, 'Notifications retrieved', {
    notifications,
    unreadCount,
    pagination: {
      page:       pageNum,
      limit:      limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  });
};

// ─── GET /notifications/unread-count ─────────────────────────────────────────

/**
 * Quick endpoint for the bell badge — returns only the unread count.
 * Called on interval or on focus by the frontend.
 */
const getUnreadCount = async (req, res) => {
  const { userId } = req.user;
  const count = await Notification.countDocuments({ userId, isRead: false });
  sendResponse(res, 200, 'Unread count retrieved', { unreadCount: count });
};

// ─── PATCH /notifications/:id/read ───────────────────────────────────────────

/**
 * Mark a single notification as read.
 * Returns 404 if the notification doesn't belong to the current user.
 */
const markAsRead = async (req, res) => {
  const { userId }         = req.user;
  const { notificationId } = req.params;

  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, userId },
    { $set: { isRead: true, readAt: new Date() } },
    { new: true }
  );

  if (!notification) {
    throw new ApiError('Notification not found.', 404);
  }

  sendResponse(res, 200, 'Notification marked as read', { notification });
};

// ─── PATCH /notifications/read-all ───────────────────────────────────────────

/**
 * Mark ALL unread notifications for the current user as read.
 */
const markAllAsRead = async (req, res) => {
  const { userId } = req.user;

  const result = await Notification.updateMany(
    { userId, isRead: false },
    { $set: { isRead: true, readAt: new Date() } }
  );

  sendResponse(res, 200, `${result.modifiedCount} notification(s) marked as read`, {
    modifiedCount: result.modifiedCount,
  });
};

module.exports = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
};
