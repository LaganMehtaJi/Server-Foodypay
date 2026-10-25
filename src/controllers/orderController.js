import mongoose from 'mongoose';
import Order from '../models/orderModel.js';
import Customer from '../models/customerModel.js';
import User from '../models/userModel.js';
import Setting from '../models/settingModel.js';
import { executeDirectKotPrint } from '../routes/printRoutes.js';

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
    const { merchantId, foodypayId, type, table, customer, phone, address, paymentMode, items, note, paymentStatus, paymentLabel, subtotal, discount, tax, total, waiterId, waiterName, placedBy } = req.body;

    let targetUser = null;
    if (merchantId && merchantId !== 'undefined') {
      targetUser = await User.findById(merchantId).catch(() => null);
    }
    if (!targetUser && foodypayId && foodypayId !== 'undefined') {
      targetUser = await User.findOne({ foodypayId });
      if (!targetUser && foodypayId.toString().trim().toUpperCase() === 'FP-9896') {
        targetUser = (await User.findOne({ email: 'laganmehta.in@gmail.com' })) || (await User.findOne({ foodypayId: 'FP-445920' }));
      }
    }
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Valid merchant identifier (merchantId or foodypayId) is required for order placement' });
    }

    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Merchant account not found for order placement' });
    }

    let finalWaiterId = waiterId || '';
    let finalWaiterName = waiterName || '';
    let finalPlacedBy = placedBy || (waiterId ? 'Waiter' : 'Customer');

    if (req.waiter) {
      finalWaiterId = req.waiter.employeeId || req.waiter.waiterId;
      finalWaiterName = req.waiter.name;
      finalPlacedBy = 'Waiter';
    }

    const shouldPrintKot = req.body.printKot === true || finalPlacedBy === 'Waiter';

    const rawT = String(table || 'Table 1').trim();
    const cleanNum = rawT.replace(/^table\s*/i, '').trim();
    const tableRegex = new RegExp(`^(table\\s*)?${cleanNum}$`, 'i');

    const formattedItems = (items || []).map(i => ({
      pid: i.pid || '',
      name: i.name,
      v: i.v || 'Regular',
      price: Number(i.price !== undefined ? i.price : (i.p !== undefined ? i.p : 0)),
      qty: Number(i.qty || 1),
      isVeg: i.isVeg !== false,
    }));

    // Prevent table order overlapping: Merge into existing running order if table is already active
    if (type !== 'Delivery' && type !== 'Pickup') {
      const existingActiveOrder = await Order.findOne({
        user: targetUser._id,
        table: { $regex: tableRegex },
        status: { $nin: ['settled', 'completed', 'cancelled'] },
      }).sort({ createdAt: -1 });

      if (existingActiveOrder) {
        existingActiveOrder.items.push(...formattedItems);
        existingActiveOrder.subtotal = (existingActiveOrder.subtotal || 0) + (Number(subtotal) || 0);
        existingActiveOrder.discount = (existingActiveOrder.discount || 0) + (Number(discount) || 0);
        existingActiveOrder.tax = (existingActiveOrder.tax || 0) + (Number(tax) || 0);
        existingActiveOrder.total = (existingActiveOrder.total || 0) + (Number(total) || 0);
        if (note && note.trim()) {
          existingActiveOrder.note = existingActiveOrder.note ? `${existingActiveOrder.note} | ${note.trim()}` : note.trim();
        }
        if (finalWaiterName) {
          existingActiveOrder.waiterName = finalWaiterName;
          existingActiveOrder.waiterId = finalWaiterId || existingActiveOrder.waiterId;
        }
        if (shouldPrintKot) {
          existingActiveOrder.kotPrinted = true;
          existingActiveOrder.printKotRequested = true;
          existingActiveOrder.kotPrintRequestedAt = new Date().toISOString();
        }
        existingActiveOrder.status = (existingActiveOrder.status === 'bill_printed') ? 'bill_printed' : (shouldPrintKot ? 'kot_printed' : existingActiveOrder.status);
        existingActiveOrder.seen = false; // Triggers fresh chime on reception POS
        existingActiveOrder.updatedAt = new Date().toISOString();

        await existingActiveOrder.save();

        if (shouldPrintKot) {
          Setting.findOne({ user: targetUser._id }).then(setting => {
            const storeInfo = {
              restName: setting?.restName || targetUser.businessName || 'FoodyPay Restaurant',
              restPhone: setting?.phone || targetUser.contactNo || '',
            };
            executeDirectKotPrint(existingActiveOrder, storeInfo).catch(() => {});
          }).catch(() => {});
        }

        return res.status(200).json({
          success: true,
          message: `Added ${formattedItems.length} new items to running order on ${rawT}`,
          data: existingActiveOrder,
          merged: true,
          storage: 'mongodb_primary',
        });
      }
    }

    const count = await Order.countDocuments({ user: targetUser._id });
    const orderId = `#FP-${1080 + count + 1}`;

    const orderData = {
      orderId,
      type: type || 'Dine-In',
      table: table || 'Table 1',
      customer: customer || (finalWaiterName ? `Diner (Served by ${finalWaiterName})` : 'Walk-in Guest'),
      phone: phone || '',
      address: address || '',
      paymentMode: paymentMode || 'Cash',
      status: shouldPrintKot ? 'kot_printed' : 'new',
      kotPrinted: shouldPrintKot,
      printKotRequested: shouldPrintKot,
      kotPrintRequestedAt: shouldPrintKot ? new Date().toISOString() : '',
      seen: false, // Unseen by merchant -> triggers sound notification
      paymentStatus: paymentStatus || 'cash',
      note: note || '',
      waiterId: finalWaiterId,
      waiterName: finalWaiterName,
      placedBy: finalPlacedBy,
      items: formattedItems,
      subtotal: Number(subtotal) || 0,
      discount: Number(discount) || 0,
      tax: Number(tax) || 0,
      total: Number(total) || 0,
      businessId: (foodypayId || targetUser.foodypayId || merchantId || '').toString().toUpperCase(),
      merchantFilter: (foodypayId || targetUser.foodypayId || merchantId || '').toString().toUpperCase(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Save order into MongoDB
    const mongoOrder = await Order.create({
      user: targetUser._id,
      foodypayId: targetUser.foodypayId || (foodypayId || '').toUpperCase(),
      ...orderData,
    });

    if (shouldPrintKot) {
      Setting.findOne({ user: targetUser._id }).then(setting => {
        const storeInfo = {
          restName: setting?.restName || targetUser.businessName || 'FoodyPay Restaurant',
          restPhone: setting?.phone || targetUser.contactNo || '',
        };
        executeDirectKotPrint(mongoOrder, storeInfo).catch(() => {});
      }).catch(() => {});
    }

    // Auto CRM Sync for Customer in MongoDB
    if (customer && customer !== 'Walk-in Guest') {
      try {
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
      } catch (custErr) {
        console.warn('Customer auto-create warning:', custErr.message);
      }
    }

    // Auto-transition to kitchen KOT after 10 seconds for customer orders
    if (!shouldPrintKot && finalPlacedBy !== 'Waiter') {
      setTimeout(async () => {
        try {
          const fresh = await Order.findById(mongoOrder._id);
          if (fresh && fresh.status === 'new') {
            fresh.status = 'kot_printed';
            fresh.kotPrinted = true;
            await fresh.save();
          }
        } catch (e) {
          console.warn('Auto-KOT transition error:', e.message);
        }
      }, 10000);
    }

    res.status(201).json({
      success: true,
      data: mongoOrder,
      storage: 'mongodb_primary',
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

    const total = await Order.countDocuments({ user: req.user._id }).catch(() => 0);
    const orders = await Order.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .catch(() => []);
    const todayStats = await calculateTodayOrderStats(req.user._id).catch(() => ({}));

    res.json({
      success: true,
      source: 'database_primary',
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
    const { merchantId, foodypayId, table, status, seen } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const skip = (page - 1) * limit;

    let filter = {};

    let targetUser = null;
    if (merchantId && merchantId !== 'undefined') {
      targetUser = await User.findById(merchantId).catch(() => null);
    }
    if (!targetUser && foodypayId && foodypayId !== 'undefined') {
      const cleanFp = foodypayId.toString().trim().toUpperCase();
      targetUser = await User.findOne({ foodypayId: cleanFp }).catch(() => null);
      if (!targetUser && cleanFp === 'FP-9896') {
        targetUser = (await User.findOne({ email: 'laganmehta.in@gmail.com' })) || (await User.findOne({ foodypayId: 'FP-445920' }));
      }
      if (!targetUser && cleanFp.startsWith('SYS-')) {
        targetUser = await User.findOne({ $or: [{ foodypayId: cleanFp }, { merchantId: cleanFp }] }).catch(() => null);
      }
    }
    if (req.user) {
      targetUser = req.user;
    } else if (!targetUser) {
      return res.status(400).json({ success: false, message: 'Authentication or valid merchant identifier is required' });
    }

    if (targetUser) {
      filter.user = targetUser._id;
    } else if (foodypayId && foodypayId !== 'undefined') {
      filter.foodypayId = foodypayId.toString().trim().toUpperCase();
    }

    if (table) {
      const rawT = String(table).trim();
      const cleanNum = rawT.replace(/^table\s*/i, '').trim();
      filter.table = { $regex: new RegExp(`^(table\\s*)?${cleanNum}$`, 'i') };
      if (!status) {
        filter.status = { $nin: ['settled', 'completed', 'cancelled'] };
      }
    }

    if (status && status !== 'all') {
      filter.status = status;
    }
    if (seen !== undefined) {
      filter.seen = seen === 'true';
    }

    const total = await Order.countDocuments(filter).catch(() => 0);
    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .catch(() => []);

    res.json({
      success: true,
      source: 'database_primary',
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
 * @desc    Update public/waiter order (add/edit/delete items or update table/customer)
 * @route   PUT /api/orders/public/:id
 * @access  Public (QR Customer) / Protected (Waiter JWT required for waiter actions)
 */
/**
 * @desc    Claim / Link personal customer details to an active running table order
 * @route   POST /api/orders/public/claim
 * @access  Public (Customer Table QR)
 */
export const claimPublicOrder = async (req, res, next) => {
  try {
    const { foodypayId, table, orderId, customer, phone, note } = req.body;

    if (!customer || !customer.trim()) {
      return res.status(400).json({ success: false, message: 'Customer name is required to claim this order' });
    }

    let query = {};
    if (orderId) {
      query = { $or: [{ _id: orderId }, { orderId: orderId }] };
    } else if (table) {
      const rawT = String(table).trim();
      const cleanNum = rawT.replace(/^table\s*/i, '').trim();
      query = {
        table: { $regex: new RegExp(`^(table\\s*)?${cleanNum}$`, 'i') },
        status: { $nin: ['settled', 'completed', 'cancelled'] },
      };
    } else {
      return res.status(400).json({ success: false, message: 'Table or orderId is required' });
    }

    if (foodypayId) {
      const cleanFp = String(foodypayId).trim().toUpperCase();
      const targetUser = await User.findOne({ foodypayId: cleanFp });
      if (targetUser) query.user = targetUser._id;
    }

    const order = await Order.findOne(query).sort({ createdAt: -1 });

    if (!order) {
      return res.status(404).json({ success: false, message: 'No running order found on this table to claim' });
    }

    order.customer = customer.trim();
    if (phone) order.phone = phone.trim();
    if (note && note.trim()) {
      order.note = order.note ? `${order.note} | ${note.trim()}` : note.trim();
    }
    order.seen = false; // Triggers fresh chime on Reception POS
    order.updatedAt = new Date().toISOString();
    await order.save();

    // CRM Auto-Sync: Register/update in Customer database
    if (order.user && customer.trim()) {
      try {
        let existingCust = await Customer.findOne({ user: order.user, name: customer.trim() });
        if (existingCust) {
          if (phone) existingCust.phone = phone.trim();
          existingCust.lastOrdered = 'Just now';
          await existingCust.save();
        } else {
          await Customer.create({
            user: order.user,
            name: customer.trim(),
            phone: (phone || '').trim(),
            ordersCount: 1,
            totalSales: order.total || 0,
            lastOrdered: 'Just now',
            tags: ['QR Table Diner'],
          });
        }
      } catch (custErr) {
        console.warn('[claimPublicOrder] Customer CRM sync warning:', custErr.message);
      }
    }

    res.json({
      success: true,
      message: `Table order claimed successfully by ${customer.trim()}! Bill will be generated in your name.`,
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

export const updatePublicOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { items, subtotal, discount, tax, total, customer, phone, note, status, paymentMode, waiterId, waiterName } = req.body;

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Security Verification: If modifying a table order with Waiter identity or Bearer token
    const isWaiterOperation = req.headers.authorization || waiterId || waiterName || req.waiter;
    if (isWaiterOperation) {
      if (!req.waiter) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized: Valid Waiter JWT token required to modify running table orders',
        });
      }

      // Check merchant match to prevent tampering
      if (
        req.waiter.foodypayId &&
        order.foodypayId &&
        req.waiter.foodypayId.toUpperCase() !== order.foodypayId.toUpperCase()
      ) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: Waiter does not belong to this restaurant',
        });
      }

      order.waiterName = req.waiter.name;
      order.waiterId = req.waiter.employeeId || req.waiter.waiterId;
    }

    if (items && Array.isArray(items)) {
      order.items = items.map(i => ({
        pid: i.pid || '',
        name: i.name,
        v: i.v || 'Regular',
        price: Number(i.price !== undefined ? i.price : (i.p !== undefined ? i.p : 0)),
        qty: Number(i.qty || 1),
        isVeg: i.isVeg !== false,
      }));
    }
    if (subtotal !== undefined) order.subtotal = Number(subtotal);
    if (discount !== undefined) order.discount = Number(discount);
    if (tax !== undefined) order.tax = Number(tax);
    if (total !== undefined) order.total = Number(total);
    if (customer !== undefined) order.customer = customer;
    if (phone !== undefined) order.phone = phone;
    if (note !== undefined) order.note = note;
    if (status) order.status = status;
    if (order.items.length === 0 || Number(order.total || 0) === 0) {
      order.status = 'settled';
    }
    if (paymentMode) order.paymentMode = paymentMode;

    order.updatedAt = new Date().toISOString();
    await order.save();

    res.json({
      success: true,
      message: 'Order updated successfully',
      waiter: req.waiter ? { name: req.waiter.name, employeeId: req.waiter.employeeId } : null,
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete/Cancel public/waiter order
 * @route   DELETE /api/orders/public/:id
 * @access  Protected (Waiter JWT required)
 */
export const deletePublicOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Require valid Waiter JWT token
    if (!req.waiter) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Valid Waiter JWT token required to cancel or clear table orders',
      });
    }

    // Merchant verification
    if (
      req.waiter.foodypayId &&
      order.foodypayId &&
      req.waiter.foodypayId.toUpperCase() !== order.foodypayId.toUpperCase()
    ) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Waiter does not belong to this restaurant',
      });
    }

    await order.deleteOne();
    res.json({
      success: true,
      message: `Order cleared successfully by Waiter ${req.waiter.name}`,
      id,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Sync table order status from Merchant POS (Ordering, KOT Printed, Bill Printed, Settled)
 * @route   POST /api/orders/pos/sync-table-status
 * @access  Public / POS
 */
export const syncPosTableStatus = async (req, res, next) => {
  try {
    const { foodypayId, table, tableName, status, kotPrinted, billPrinted, items, total, subtotal, customer, phone } = req.body;

    const cleanFp = (foodypayId || '').toString().trim().toUpperCase();
    if (!cleanFp || !table) {
      return res.status(400).json({ success: false, message: 'foodypayId and table are required' });
    }

    const targetUser = await User.findOne({ foodypayId: cleanFp });
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Merchant not found' });
    }

    const rawT = String(tableName || table).trim();
    const cleanNum = rawT.replace(/^table\s*/i, '').trim();
    const tableRegex = new RegExp(`^(table\\s*)?${cleanNum}$`, 'i');

    const cleanStatus = (status || '').toLowerCase().trim();

    // If order was cancelled from dashboard, mark all running orders on table as cancelled
    if (cleanStatus === 'cancelled') {
      const cancelResult = await Order.updateMany(
        {
          user: targetUser._id,
          table: { $regex: tableRegex },
          status: { $nin: ['settled', 'completed'] },
        },
        {
          $set: {
            status: 'cancelled',
            seen: true,
            updatedAt: new Date(),
          },
        }
      );
      return res.json({
        success: true,
        message: 'Table orders marked cancelled',
        modifiedCount: cancelResult.modifiedCount,
        table: rawT,
      });
    }

    // If order is settled or table cleared, close running orders on this table
    if (cleanStatus === 'settled' || cleanStatus === 'completed' || cleanStatus === 'blank') {
      const settledResult = await Order.updateMany(
        {
          user: targetUser._id,
          table: { $regex: tableRegex },
          status: { $nin: ['settled', 'completed', 'cancelled'] },
        },
        {
          $set: {
            status: 'settled',
            seen: true,
            updatedAt: new Date(),
          },
        }
      );
      return res.json({
        success: true,
        message: 'Table orders marked settled',
        modifiedCount: settledResult.modifiedCount,
        table: rawT,
      });
    }

    // Find active order for this table
    let activeOrder = await Order.findOne({
      user: targetUser._id,
      table: { $regex: tableRegex },
      status: { $nin: ['settled', 'completed', 'cancelled'] },
    }).sort({ createdAt: -1 });

    const formattedItems = (Array.isArray(items) && items.length > 0)
      ? items.map(i => ({
          pid: i.pid || i.id || '',
          name: i.name,
          v: i.v || 'Regular',
          price: Number(i.price !== undefined ? i.price : (i.p !== undefined ? i.p : 0)),
          qty: Number(i.qty || 1),
          isVeg: i.isVeg !== false,
        }))
      : [];

    const isKot = !!(kotPrinted || cleanStatus === 'kot_printed');
    const isBill = !!(billPrinted || cleanStatus === 'bill_printed' || cleanStatus === 'billed');
    const assignedStatus = isBill ? 'bill_printed' : (isKot ? 'kot_printed' : (cleanStatus || 'ordering'));

    if (activeOrder) {
      if (formattedItems.length === 0 || Number(total || 0) === 0) {
        activeOrder.status = 'settled';
        activeOrder.seen = true;
        await activeOrder.save();
        return res.json({
          success: true,
          message: 'Table order cleared as blank (0 items)',
          table: rawT,
        });
      }
      activeOrder.status = assignedStatus;
      activeOrder.kotPrinted = isKot;
      activeOrder.billPrinted = isBill;
      if (formattedItems.length > 0) {
        activeOrder.items = formattedItems;
      }
      if (total !== undefined) activeOrder.total = Number(total);
      if (subtotal !== undefined) activeOrder.subtotal = Number(subtotal);
      if (customer) activeOrder.customer = customer;
      if (phone) activeOrder.phone = phone;
      activeOrder.seen = true;
      await activeOrder.save();

      return res.json({
        success: true,
        message: 'Active table order updated',
        data: activeOrder,
      });
    } else {
      // Create new active table order if items exist
      if (formattedItems.length === 0 || Number(total || 0) === 0) {
        return res.json({
          success: true,
          message: 'Table is blank, no order created',
          table: rawT,
        });
      }

      const count = await Order.countDocuments({ user: targetUser._id });
      const orderId = `#FP-${1080 + count + 1}`;

      const newOrder = await Order.create({
        user: targetUser._id,
        foodypayId: cleanFp,
        orderId,
        type: 'Dine-In',
        table: rawT.toLowerCase().startsWith('table') ? rawT : `Table ${cleanNum}`,
        customer: customer || 'Walk-in Guest',
        phone: phone || '',
        status: assignedStatus,
        kotPrinted: isKot,
        billPrinted: isBill,
        items: formattedItems,
        subtotal: Number(subtotal || total || 0),
        total: Number(total || 0),
        placedBy: 'Counter',
        seen: true,
      });

      return res.json({
        success: true,
        message: 'New table order created and synced',
        data: newOrder,
      });
    }
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
    if (order.items.length === 0 || Number(order.total || 0) === 0) {
      order.status = 'settled';
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
    if (order.items.length === 0 || Number(order.total || 0) === 0) {
      order.status = 'settled';
    }
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
