/**
 * src/models/Notification.js
 *
 * Notification — in-app notification for a user.
 *
 * Status lifecycle: unread → read (one-way)
 *
 * type values (extend as features grow):
 *   investment_received  → startup: someone invested in your campaign
 *   investment_confirmed → investor: your investment was confirmed
 *   milestone_updated    → investor: a campaign you invested in updated a milestone
 *   milestone_approved   → startup: your milestone was approved by admin
 *   milestone_rejected   → startup: your milestone was rejected
 *   milestone_disbursed  → startup: milestone funds disbursed
 *   campaign_funded      → startup: campaign reached funding goal
 *   system               → generic platform notification
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

const notificationSchema = new Schema(
  {
    // ── Target user ────────────────────────────────────────────────────────────
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'userId is required'],
    },

    // ── Notification type ──────────────────────────────────────────────────────
    type: {
      type: String,
      required: [true, 'type is required'],
      enum: {
        values: [
          'investment_received',
          'investment_confirmed',
          'milestone_updated',
          'milestone_approved',
          'milestone_rejected',
          'milestone_disbursed',
          'campaign_funded',
          'startup_verified',
          'startup_rejected',
          'startup_needs_info',
          'system',
        ],
        message: 'Invalid notification type: {VALUE}',
      },
    },

    // ── Human-readable message ─────────────────────────────────────────────────
    message: {
      type: String,
      required: [true, 'message is required'],
      trim: true,
      maxlength: [500, 'message cannot exceed 500 characters'],
    },

    // ── Read state ─────────────────────────────────────────────────────────────
    isRead: {
      type: Boolean,
      default: false,
    },

    readAt: {
      type: Date,
      default: null,
    },

    // ── Optional metadata (deep-link payload for frontend routing) ─────────────
    // e.g. { campaignId: '...', milestoneId: '...' }
    meta: {
      type: Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

// Primary: fetch all notifications for a user, newest first
notificationSchema.index({ userId: 1, createdAt: -1 });

// Unread count badge query
notificationSchema.index({ userId: 1, isRead: 1 });

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;
