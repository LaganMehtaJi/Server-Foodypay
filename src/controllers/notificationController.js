import Notification from '../models/notificationModel.js';
import Order from '../models/orderModel.js';
import User from '../models/userModel.js';

/**
 * @desc    Send / Broadcast Notification & Persist to Backend MongoDB
 * @route   POST /api/notifications/send
 * @access  Private
 */
export const sendNotification = async (req, res, next) => {
  try {
    const {
      title,
      message,
      audienceMode,
      targetCustomerPhone,
      targetCustomerEmail,
      targetCustomerName,
      channel,
      metadata,
    } = req.body;

    if (!title || !message) {
      res.status(400);
      throw new Error('Please provide title and message content for notification broadcast');
    }

    const notification = await Notification.create({
      user: req.user._id,
      title: title.trim(),
      message: message.trim(),
      audienceMode: audienceMode || 'all_users',
      targetCustomerPhone: targetCustomerPhone || '',
      targetCustomerEmail: targetCustomerEmail || '',
      targetCustomerName: targetCustomerName || '',
      channel: channel || 'push_whatsapp',
      status: 'sent',
      read: false,
      metadata: metadata || {},
    });

    res.status(201).json({
      success: true,
      data: notification,
      message: 'Push notification broadcast persisted and dispatched successfully.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all notifications for authenticated dashboard user
 * @route   GET /api/notifications
 * @access  Private
 */
export const getNotifications = async (req, res, next) => {
  try {
    const notifications = await Notification.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json({
      success: true,
      count: notifications.length,
      data: notifications,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Real-Time Alerts Feed for FoodyPay Chrome Extension
 * @route   GET /api/notifications/extension-feed
 * @access  Public
 */
export const getExtensionFeed = async (req, res, next) => {
  try {
    const { merchantId, foodypayId, since } = req.query;

    let userQuery = {};
    if (merchantId || foodypayId) {
      const identifier = merchantId || foodypayId;
      const merchant = await User.findOne({
        $or: [{ foodypayId: identifier }, { _id: identifier.match(/^[0-9a-fA-F]{24}$/) ? identifier : null }],
      });
      if (merchant) {
        userQuery.user = merchant._id;
      }
    }

    const sinceDate = since ? new Date(since) : new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Fetch real persistent notifications from DB
    const notifications = await Notification.find({
      ...userQuery,
      createdAt: { $gte: sinceDate },
    }).sort({ createdAt: -1 });

    // Also fetch recent new live orders from DB for real-time extension order alerts
    const recentOrders = await Order.find({
      ...userQuery,
      createdAt: { $gte: sinceDate },
    }).sort({ createdAt: -1 }).limit(10);

    const unseenOrdersCount = recentOrders.filter(o => !o.seen && o.status === 'new').length;

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      unseenOrdersCount,
      notificationsCount: notifications.length,
      orders: recentOrders,
      notifications: notifications,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Mark Notification as Read
 * @route   PUT /api/notifications/:id/read
 * @access  Private
 */
export const markNotificationRead = async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { read: true, status: 'read' },
      { new: true }
    );

    if (!notification) {
      res.status(404);
      throw new Error('Notification not found');
    }

    res.json({
      success: true,
      data: notification,
    });
  } catch (error) {
    next(error);
  }
};
