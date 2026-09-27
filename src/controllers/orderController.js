import Order from '../models/orderModel.js';
import Customer from '../models/customerModel.js';
import User from '../models/userModel.js';

/**
 * @desc    Create a new public customer order (from table QR code scan)
 * @route   POST /api/orders/public
 * @access  Public
 */
export const createPublicOrder = async (req, res, next) => {
  try {
    const { merchantId, foodypayId, type, table, customer, phone, items, note, paymentStatus, paymentLabel, subtotal, discount, tax, total } = req.body;

    let targetUser = null;
    if (merchantId) {
      targetUser = await User.findById(merchantId).catch(() => null);
    }
    if (!targetUser && foodypayId) {
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
 * @desc    Create a new manual / online order
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

    res.status(201).json({
      success: true,
      data: order,
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

    const { type, table, customer, phone, items, note, paymentStatus, paymentLabel, subtotal, discount, tax, total } = req.body;

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

    await order.save();

    res.json({
      success: true,
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update order status
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

    await order.save();

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
    const order = await Order.findOneAndDelete({ _id: req.params.id, user: req.user._id });

    if (!order) {
      res.status(404);
      throw new Error('Order not found');
    }

    res.json({
      success: true,
      message: 'Order deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
