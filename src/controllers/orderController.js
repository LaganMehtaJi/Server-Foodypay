import mongoose from 'mongoose';
import Order from '../models/orderModel.js';
import Customer from '../models/customerModel.js';
import User from '../models/userModel.js';
import {
  syncOrderToFirestore,
  updateOrderInFirestore,
  deleteOrderFromFirestore,
} from '../services/firestoreService.js';

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
                  $cond: [{ $in: ['$status', ['completed', 'delivered', 'served']] }, '$total', 0]
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
                  $cond: [{ $in: ['$status', ['completed', 'delivered', 'served']] }, '$total', 0]
                }
              },
              pendingOrders: {
                $sum: {
                  $cond: [{ $in: ['$status', ['new', 'preparing', 'ready', 'out_for_delivery', 'dispatched']] }, 1, 0]
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
 * @desc    Create a new public customer order (from table QR code scan or online delivery)
 * @route   POST /api/orders/public
 * @access  Public
 */
export const createPublicOrder = async (req, res, next) => {
  try {
    const { merchantId, foodypayId, type, table, customer, phone, address, paymentMode, items, note, paymentStatus, paymentLabel, subtotal, discount, tax, total } = req.body;

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
      address: address || '',
      paymentMode: paymentMode || 'Cash',
      status: 'new',
      seen: false, // Unseen by merchant -> triggers sound notification
      sentToKitchen: false, // Must be approved/sent to Kitchen from POS Dashboard first
      kitchenSeen: false, // Unseen by kitchen staff -> triggers alarm bell until acknowledged
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

    // Sync directly to Cloud Firestore for real-time live displays
    syncOrderToFirestore(order).catch(() => {});

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
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const skip = (page - 1) * limit;

    const total = await Order.countDocuments({ user: req.user._id });
    const orders = await Order.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    const todayStats = await calculateTodayOrderStats(req.user._id);

    res.json({
      success: true,
      count: orders.length,
      total,
      totalPages: Math.ceil(total / limit) || 1,
      currentPage: page,
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
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const skip = (page - 1) * limit;

    let targetUser = null;

    if (merchantId && merchantId !== 'undefined') {
      targetUser = await User.findById(merchantId).catch(() => null);
    }
    if (!targetUser && foodypayId && foodypayId !== 'undefined') {
      targetUser = await User.findOne({ foodypayId });
    }

    if (!targetUser) {
      return res.json({ success: true, count: 0, total: 0, totalPages: 0, currentPage: page, data: [] });
    }

    const total = await Order.countDocuments({ user: targetUser._id });
    const orders = await Order.find({ user: targetUser._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      success: true,
      count: orders.length,
      total,
      totalPages: Math.ceil(total / limit) || 1,
      currentPage: page,
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

    // Sync directly to Cloud Firestore
    syncOrderToFirestore(order).catch(() => {});

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
 * Helper to find order safely by Mongo _id or string orderId
 */
const findOrderByIdOrCode = async (idParam, userId = null) => {
  const query = userId ? { user: userId } : {};
  let order = null;
  if (mongoose.Types.ObjectId.isValid(idParam)) {
    order = await Order.findOne({ _id: idParam, ...query });
  }
  if (!order) {
    order = await Order.findOne({ orderId: idParam, ...query });
  }
  return order;
};

/**
 * @desc    Update existing order (Items, Customer info, Payment, Totals)
 * @route   PUT /api/orders/:id
 * @access  Private
 */
export const updateOrder = async (req, res, next) => {
  try {
    const order = await findOrderByIdOrCode(req.params.id, req.user._id);

    if (!order) {
      res.status(404);
      throw new Error('Order not found');
    }

    const { type, table, customer, phone, items, note, paymentStatus, paymentLabel, subtotal, discount, tax, total, status, sentToKitchen, kitchenSeen, isPaid, dueNote, dueMarkedAt, dueClearedAt, dueClearedMode } = req.body;

    if (order.status !== 'new' && items && !status && !paymentStatus) {
      res.status(400);
      throw new Error('Cannot edit order items once cooking has started');
    }

    if (type) order.type = type;
    if (table) order.table = table;
    if (customer) order.customer = customer;
    if (phone !== undefined) order.phone = phone;
    if (items) order.items = items;
    if (note !== undefined) order.note = note;
    if (paymentStatus) order.paymentStatus = paymentStatus;
    if (paymentLabel) order.paymentLabel = paymentLabel;
    if (isPaid !== undefined) order.isPaid = isPaid;
    if (dueNote !== undefined) order.dueNote = dueNote;
    if (dueMarkedAt !== undefined) order.dueMarkedAt = dueMarkedAt;
    if (dueClearedAt !== undefined) order.dueClearedAt = dueClearedAt;
    if (dueClearedMode !== undefined) order.dueClearedMode = dueClearedMode;
    if (subtotal !== undefined) order.subtotal = subtotal;
    if (discount !== undefined) order.discount = discount;
    if (tax !== undefined) order.tax = tax;
    if (total !== undefined) order.total = total;
    if (status) order.status = status;
    if (sentToKitchen !== undefined) order.sentToKitchen = sentToKitchen;
    if (kitchenSeen !== undefined) order.kitchenSeen = kitchenSeen;

    await order.save();
    syncOrderToFirestore(order).catch(() => {});
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
    const { status, paymentStatus, paymentLabel, sentToKitchen, kitchenSeen } = req.body;
    const order = await findOrderByIdOrCode(req.params.id, req.user._id);

    if (!order) {
      res.status(404);
      throw new Error('Order not found');
    }

    if (status) order.status = status;
    if (paymentStatus) order.paymentStatus = paymentStatus;
    if (paymentLabel) order.paymentLabel = paymentLabel;
    if (sentToKitchen !== undefined) order.sentToKitchen = sentToKitchen;
    if (kitchenSeen !== undefined) order.kitchenSeen = kitchenSeen;
    if (status === 'completed' || status === 'ready') {
      order.seen = true;
      order.kitchenSeen = true;
    } else if (status === 'preparing') {
      order.seen = true;
      order.sentToKitchen = true;
      order.kitchenSeen = false;
    }

    await order.save();
    syncOrderToFirestore(order).catch(() => {});
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
    const order = await findOrderByIdOrCode(req.params.id, req.user._id);
    if (!order) {
      res.status(404);
      throw new Error('Order not found');
    }
    order.seen = true;
    await order.save();
    syncOrderToFirestore(order).catch(() => {});

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
 * @desc    Mark order as SEEN by kitchen staff (stops kitchen alarm bell)
 * @route   PUT /api/orders/:id/kitchen-seen
 * @access  Private
 */
export const markKitchenSeen = async (req, res, next) => {
  try {
    const order = await findOrderByIdOrCode(req.params.id, req.user._id);
    if (!order) {
      res.status(404);
      throw new Error('Order not found');
    }
    order.kitchenSeen = true;
    await order.save();
    syncOrderToFirestore(order).catch(() => {});

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
 * @desc    Public status update for Kitchen Display System (unauthenticated KDS screen)
 * @route   PUT /api/orders/public/:id/status
 * @access  Public
 */
export const updatePublicOrderStatus = async (req, res, next) => {
  try {
    const { status, kitchenSeen, sentToKitchen } = req.body;
    const order = await findOrderByIdOrCode(req.params.id);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (status) order.status = status;
    if (kitchenSeen !== undefined) order.kitchenSeen = kitchenSeen;
    if (sentToKitchen !== undefined) order.sentToKitchen = sentToKitchen;
    if (status === 'preparing' || status === 'ready' || status === 'completed') {
      order.kitchenSeen = true;
    }

    await order.save();
    syncOrderToFirestore(order).catch(() => {});

    res.json({
      success: true,
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Public mark kitchen seen for Kitchen Display System
 * @route   PUT /api/orders/public/:id/kitchen-seen
 * @access  Public
 */
export const markPublicKitchenSeen = async (req, res, next) => {
  try {
    const order = await findOrderByIdOrCode(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    order.kitchenSeen = true;
    await order.save();
    syncOrderToFirestore(order).catch(() => {});

    res.json({
      success: true,
      data: order,
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
    const order = await findOrderByIdOrCode(req.params.id, req.user._id);

    if (!order) {
      res.status(404);
      throw new Error('Order not found');
    }

    const orderDocId = String(order._id || order.id || order.orderId);
    await order.deleteOne();
    deleteOrderFromFirestore(orderDocId).catch(() => {});

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

/**
 * @desc    Move KOT / Shift order to another table
 * @route   PATCH /api/orders/:id/move-table
 * @access  Private
 */
export const moveKotTable = async (req, res, next) => {
  try {
    const { targetTable } = req.body;
    if (!targetTable) {
      return res.status(400).json({ success: false, message: 'targetTable is required' });
    }

    const order = await findOrderByIdOrCode(req.params.id, req.user._id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const previousTable = order.table;
    order.table = targetTable;
    order.note = order.note ? `${order.note} (Shifted from ${previousTable} to ${targetTable})` : `Shifted from ${previousTable} to ${targetTable}`;

    await order.save();
    syncOrderToFirestore(order).catch(() => {});

    res.json({
      success: true,
      message: `Order successfully shifted from ${previousTable} to ${targetTable}`,
      data: order,
    });
  } catch (error) {
    next(error);
  }
};
