/**
 * src/api/notifications.api.js
 *
 * Notification API calls.
 *
 *   GET   /api/v1/notifications             → paginated list
 *   GET   /api/v1/notifications/unread-count → bell badge
 *   PATCH /api/v1/notifications/read-all    → mark all read
 *   PATCH /api/v1/notifications/:id/read   → mark one read
 */

import client from './client';

export const getNotifications = async ({ page = 1, limit = 20, unreadOnly = false } = {}) => {
  const { data } = await client.get('/notifications', {
    params: { page, limit, unreadOnly: unreadOnly ? 'true' : undefined },
  });
  return data.data; // { notifications, unreadCount, pagination }
};

export const getUnreadCount = async () => {
  const { data } = await client.get('/notifications/unread-count');
  return data.data.unreadCount;
};

export const markAsRead = async (notificationId) => {
  const { data } = await client.patch(`/notifications/${notificationId}/read`);
  return data.data.notification;
};

export const markAllAsRead = async () => {
  const { data } = await client.patch('/notifications/read-all');
  return data.data;
};
