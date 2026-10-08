import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    audienceMode: {
      type: String,
      enum: ['all_users', 'specific_user', 'random_n', 'group'],
      default: 'all_users',
    },
    targetCustomerPhone: {
      type: String,
      default: '',
    },
    targetCustomerEmail: {
      type: String,
      default: '',
    },
    targetCustomerName: {
      type: String,
      default: '',
    },
    channel: {
      type: String,
      default: 'push_whatsapp',
    },
    status: {
      type: String,
      enum: ['sent', 'delivered', 'read', 'pending'],
      default: 'sent',
    },
    read: {
      type: Boolean,
      default: false,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;
