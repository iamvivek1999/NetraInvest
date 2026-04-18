/**
 * src/routes/notification.routes.js
 *
 * Notification routes — all require authentication.
 *
 * Route map (all prefixed by /api/v1/notifications):
 *   GET   /                    → list notifications (paginated)
 *   GET   /unread-count        → bell badge count
 *   PATCH /read-all            → mark all as read
 *   PATCH /:notificationId/read → mark single as read
 *
 * IMPORTANT: /read-all must be declared BEFORE /:notificationId/read
 * to prevent Express treating "read-all" as a notificationId.
 */

const express = require('express');
const router  = express.Router();

const {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} = require('../controllers/notification.controller');

const { protect } = require('../middleware/auth');

router.get('/',             protect, getNotifications);
router.get('/unread-count', protect, getUnreadCount);
router.patch('/read-all',   protect, markAllAsRead);
router.patch('/:notificationId/read', protect, markAsRead);

module.exports = router;
