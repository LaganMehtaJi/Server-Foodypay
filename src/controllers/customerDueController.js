import {
  getCustomerDuesFromFirestore,
  recordCustomerDueInFirestore,
  settleCustomerDueInFirestore,
} from '../services/firestoreService.js';
import Order from '../models/orderModel.js';

/**
 * @desc    Get customer dues / khata records
 * @route   GET /api/customer-dues
 * @access  Private
 */
export const getCustomerDues = async (req, res, next) => {
  try {
    const { phone } = req.query;
    const userId = req.user ? req.user._id : null;

    // Fetch from Firestore
    let dues = await getCustomerDuesFromFirestore(userId, phone);

    // Also include any orders marked as unpaid/due in MongoDB
    if (userId) {
      try {
        const query = { user: userId, isPaid: false };
        if (phone) query.phone = phone;
        const dueOrders = await Order.find(query).sort({ createdAt: -1 });

        const orderDues = dueOrders.map((o) => ({
          id: `order_due_${o._id}`,
          orderId: o.orderId || `#FP-${o._id}`,
          customer: o.customer || 'Guest',
          phone: o.phone || '',
          amount: o.total || 0,
          dueNote: o.dueNote || 'Bill Marked As Due at POS Counter',
          date: o.dueMarkedAt || o.createdAt,
          status: 'unpaid',
          table: o.table || 'Table 1',
        }));

        // Merge without duplicates
        const existingOrderIds = new Set(dues.map((d) => d.orderId));
        orderDues.forEach((od) => {
          if (!existingOrderIds.has(od.orderId)) {
            dues.push(od);
          }
        });
      } catch (dbErr) {
        // Continue with firestore dues
      }
    }

    res.json({
      success: true,
      count: dues.length,
      data: dues,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Record new customer due / udhaar
 * @route   POST /api/customer-dues
 * @access  Private
 */
export const recordCustomerDue = async (req, res, next) => {
  try {
    const { orderId, customer, phone, amount, dueNote, table } = req.body;
    const userId = req.user ? req.user._id : null;

    const dueData = {
      user: userId,
      orderId: orderId || `#FP-${Date.now()}`,
      customer: customer || 'Guest',
      phone: phone || '',
      amount: Number(amount) || 0,
      dueNote: dueNote || 'Due khata recorded at billing counter',
      table: table || 'Table 1',
      status: 'unpaid',
      createdAt: new Date().toISOString(),
    };

    const saved = await recordCustomerDueInFirestore(dueData);

    // If linked to an order, update order isPaid flag
    if (orderId && userId) {
      try {
        await Order.findOneAndUpdate(
          { orderId, user: userId },
          { isPaid: false, dueNote, dueMarkedAt: new Date() }
        );
      } catch (e) {}
    }

    res.status(201).json({
      success: true,
      data: saved?.data || dueData,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Settle / clear customer due
 * @route   POST /api/customer-dues/settle
 * @access  Private
 */
export const settleCustomerDue = async (req, res, next) => {
  try {
    const { dueId, orderId, phone, mode, amount, note } = req.body;
    const userId = req.user ? req.user._id : null;

    // Update in Firestore
    if (dueId) {
      await settleCustomerDueInFirestore(dueId, { mode, amount, note });
    }

    // Update associated Order in MongoDB if orderId provided
    if (orderId && userId) {
      try {
        await Order.findOneAndUpdate(
          { orderId, user: userId },
          {
            isPaid: true,
            dueClearedAt: new Date(),
            dueClearedMode: mode || 'Cash',
            paymentStatus: mode ? mode.toLowerCase() : 'cash',
            paymentLabel: `${mode || 'Cash'} (Due Cleared)`,
          }
        );
      } catch (e) {}
    }

    res.json({
      success: true,
      message: 'Customer due successfully settled and marked as cleared in Khata ledger.',
    });
  } catch (error) {
    next(error);
  }
};
