import mongoose from 'mongoose';
import Order from '../models/orderModel.js';
import Customer from '../models/customerModel.js';
import User from '../models/userModel.js';

/**
 * MongoDB Aggregation Pipeline to calculate Today's Sales & Today's Orders
 */
export const calculateTodayOrderStats = async (userId) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const userObjectId = new mongoose.Types.ObjectId(userId);

  const result = await Order.aggregate([
    { $match: { user: userObjectId } },
    {
      $facet: {
        today: [
          { $match: { createdAt: { $gte: startOfDay, $lte: endOfDay } } },
          {
            $group: {
              _id: null,
              todayOrders: { $sum: 1 },
              todaySales: {
                $sum: {
                  $cond: [{ $eq: ['$status', 'completed'] }, '$total', 0]
                }
              },
              todayGross: { $sum: '$total' }
            }
          }
        ],
        total: [
          {
            $group: {
              _id: null,
              totalOrders: { $sum: 1 },
              totalSales: {
                $sum: {
                  $cond: [{ $eq: ['$status', 'completed'] }, '$total', 0]
                }
              },
              pendingOrders: {
                $sum: {
                  $cond: [{ $in: ['$status', ['new', 'preparing', 'ready']] }, 1, 0]
                }
              }
            }
          }
        ]
      }
    }
  ]);

  const todayFacet = result[0]?.today[0] || { todayOrders: 0, todaySales: 0, todayGross: 0 };
  const totalFacet = result[0]?.total[0] || { totalOrders: 0, totalSales: 0, pendingOrders: 0 };

  return {
    todayOrders: todayFacet.todayOrders || 0,
    todaySales: todayFacet.todaySales > 0 ? todayFacet.todaySales : todayFacet.todayGross || 0,
    todayGross: todayFacet.todayGross || 0,
    totalOrders: totalFacet.totalOrders || 0,
    totalSales: totalFacet.totalSales || 0,
    pendingOrders: totalFacet.pendingOrders || 0,
  };
};

/**
 * @desc    Get aggregated today's sales & order stats
 * @route   GET /api/orders/stats
 * @access  Private
 */
export const getOrderStats = async (req, res, next) => {
  try {
    const stats = await calculateTodayOrderStats(req.user._id);
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create a new public customer order (from table QR code scan)
 * @route   POST /api/orders/public
 * @access  Public
 */
export const createPublicOrder = async (req, res, next) => {
  try {
    const { merchantId, foodypayId, type, table, customer, phone, items, note, paymentStatus, paymentLabel, subtotal, discount, tax, total } = req.body;

    let targetUser = null;
    if (merchantId && merchantId !== 'undefined') {
      targetUser = await User.findById(merchantId).catch(() => null);
    }
    if (!targetUser && foodypayId && foodypayId !== 'undefined') {
      targetUser = await User.findOne({ foodypayId });
    }
    if (!targetUser) {
      targetUser = await User.findOne(); // Fallback to primary account
    }

    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Merchant account not found for order placement' });
    }

    const count = await Order.countDocuments({ user: targetUser._id });
    const orderId = `#FP-${1080 + count + 1}`;

    const order = await Order.create({
      user: targetUser._id,
      orderId,
      type: type || 'Dine-In',
      table: table || 'Table 1',
      customer: customer || 'Walk-in Guest',
      phone: phone || '',
      status: 'new',
      seen: false, // Unseen by merchant -> triggers sound notification
      paymentStatus: paymentStatus || 'cash',
      paymentLabel: paymentLabel || 'Cash on Counter',
      items: items || [],
      note: note || '',
      subtotal: subtotal || 0,
      discount: discount || 0,
      tax: tax || 0,
      total: total || 0,
    });

    // Auto CRM Sync for Customer
    if (customer && customer !== 'Walk-in Guest') {
      const existingCustomer = await Customer.findOne({ user: targetUser._id, name: customer });
      if (existingCustomer) {
        existingCustomer.ordersCount += 1;
        existingCustomer.totalSales += total || 0;
        existingCustomer.lastOrdered = 'Just now';
        await existingCustomer.save();
      } else {
        await Customer.create({
          user: targetUser._id,
          name: customer,
          phone: phone || '',
          ordersCount: 1,
          totalSales: total || 0,
          lastOrdered: 'Just now',
          tags: ['QR Diner'],
        });
      }
    }

    res.status(201).json({
      success: true,
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all orders for authenticated user
 * @route   GET /api/orders
 * @access  Private
 */
export const getOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
    const todayStats = await calculateTodayOrderStats(req.user._id);

    res.json({
      success: true,
      count: orders.length,
      data: orders,
      todayStats,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get public orders for Kitchen Display System / Table QR view
 * @route   GET /api/orders/public
 * @access  Public (filtered by merchantId or foodypayId)
 */
export const getPublicOrders = async (req, res, next) => {
  try {
    const { merchantId, foodypayId } = req.query;
    let targetUser = null;

    if (merchantId && merchantId !== 'undefined') {
      targetUser = await User.findById(merchantId).catch(() => null);
    }
    if (!targetUser && foodypayId && foodypayId !== 'undefined') {
      targetUser = await User.findOne({ foodypayId });
    }

    if (!targetUser) {
      return res.json({ success: true, count: 0, data: [] });
    }

    const orders = await Order.find({ user: targetUser._id }).sort({ createdAt: -1 });
    res.json({
      success: true,
      count: orders.length,
      data: orders,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create a new manual / counter order
 * @route   POST /api/orders
 * @access  Private
 */
export const createOrder = async (req, res, next) => {
  try {
    const { type, table, customer, phone, items, note, paymentStatus, paymentLabel, subtotal, discount, tax, total } = req.body;

    const count = await Order.countDocuments({ user: req.user._id });
    const orderId = `#FP-${1080 + count + 1}`;

    const order = await Order.create({
      user: req.user._id,
      orderId,
      type: type || 'Dine-In',
      table: table || 'Table 1',
      customer: customer || 'Walk-in Guest',
      phone: phone || '',
      status: 'new',
      seen: true, // Manual order created directly by counter staff is auto-seen
      paymentStatus: paymentStatus || 'cash',
      paymentLabel: paymentLabel || 'Cash on Counter',
      items: items || [],
      note: note || '',
      subtotal: subtotal || 0,
      discount: discount || 0,
      tax: tax || 0,
      total: total || 0,
    });

    // Automatically update or create customer record in CRM
    if (customer && customer !== 'Walk-in Guest') {
      const existingCustomer = await Customer.findOne({ user: req.user._id, name: customer });
      if (existingCustomer) {
        existingCustomer.ordersCount += 1;
        existingCustomer.totalSales += total || 0;
        existingCustomer.lastOrdered = 'Just now';
        await existingCustomer.save();
      } else {
        await Customer.create({
          user: req.user._id,
          name: customer,
          phone: phone || '',
          ordersCount: 1,
          totalSales: total || 0,
          lastOrdered: 'Just now',
        });
      }
    }

    const todayStats = await calculateTodayOrderStats(req.user._id);

    res.status(201).json({
      success: true,
      data: order,
      todayStats,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update existing order (Items, Customer info, Payment, Totals)
 * @route   PUT /api/orders/:id
 * @access  Private
 */
export const updateOrder = async (req, res, next) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, user: req.user._id });

    if (!order) {
      res.status(404);
      throw new Error('Order not found');
    }

    if (order.status !== 'new') {
      res.status(400);
      throw new Error('Cannot edit order once cooking has started');
    }

    const { type, table, customer, phone, items, note, paymentStatus, paymentLabel, subtotal, discount, tax, total, status } = req.body;

    if (type) order.type = type;
    if (table) order.table = table;
    if (customer) order.customer = customer;
    if (phone !== undefined) order.phone = phone;
    if (items) order.items = items;
    if (note !== undefined) order.note = note;
    if (paymentStatus) order.paymentStatus = paymentStatus;
    if (paymentLabel) order.paymentLabel = paymentLabel;
    if (subtotal !== undefined) order.subtotal = subtotal;
    if (discount !== undefined) order.discount = discount;
    if (tax !== undefined) order.tax = tax;
    if (total !== undefined) order.total = total;
    if (status) order.status = status;

    await order.save();
    const todayStats = await calculateTodayOrderStats(req.user._id);

    res.json({
      success: true,
      data: order,
      todayStats,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update order status / cash settlement
 * @route   PUT /api/orders/:id/status
 * @access  Private
 */
export const updateOrderStatus = async (req, res, next) => {
  try {
    const { status, paymentStatus, paymentLabel } = req.body;
    const order = await Order.findOne({ _id: req.params.id, user: req.user._id });

    if (!order) {
      res.status(404);
      throw new Error('Order not found');
    }

    if (status) order.status = status;
    if (paymentStatus) order.paymentStatus = paymentStatus;
    if (paymentLabel) order.paymentLabel = paymentLabel;
    if (status === 'completed' || status === 'preparing' || status === 'ready') {
      order.seen = true;
    }

    await order.save();
    const todayStats = await calculateTodayOrderStats(req.user._id);

    res.json({
      success: true,
      data: order,
      todayStats,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Mark order as SEEN by counter staff (stops continuous alarm)
 * @route   PUT /api/orders/:id/seen
 * @access  Private
 */
export const markOrderSeen = async (req, res, next) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
    if (!order) {
      res.status(404);
      throw new Error('Order not found');
    }
    order.seen = true;
    await order.save();

    const todayStats = await calculateTodayOrderStats(req.user._id);

    res.json({
      success: true,
      data: order,
      todayStats,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete order
 * @route   DELETE /api/orders/:id
 * @access  Private
 */
export const deleteOrder = async (req, res, next) => {
  try {
    const order = await Order.findOneAndDelete({ _id: req.params.id, user: req.user._id });

    if (!order) {
      res.status(404);
      throw new Error('Order not found');
    }

    const todayStats = await calculateTodayOrderStats(req.user._id);

    res.json({
      success: true,
      message: 'Order deleted successfully',
      todayStats,
    });
  } catch (error) {
    next(error);
  }
};
