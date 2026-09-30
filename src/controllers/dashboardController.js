import { calculateTodayOrderStats } from './orderController.js';
import Order from '../models/orderModel.js';

/**
 * @desc    Get dashboard metrics & user details
 * @route   GET /api/dashboard
 * @access  Private (JWT Protected)
 */
export const getDashboardData = async (req, res, next) => {
  try {
    const user = req.user;

    const aggregatedStats = await calculateTodayOrderStats(user._id);

    const recentOrders = await Order.find({ user: user._id })
      .sort({ createdAt: -1 })
      .limit(5);

    const recentTransactions = recentOrders.map((ord) => ({
      id: ord.orderId || ord._id,
      customer: ord.customer || 'Walk-in Guest',
      amount: ord.total || 0,
      status: ord.status === 'completed' ? 'Paid' : 'Pending',
      time: ord.createdAt ? new Date(ord.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently',
    }));

    res.json({
      success: true,
      message: `Welcome to your Dashboard, ${user.name}!`,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          businessName: user.businessName,
          contactNo: user.contactNo,
          logo: user.logo,
          authProvider: user.authProvider,
          createdAt: user.createdAt,
        },
        stats: {
          todayOrders: aggregatedStats.todayOrders,
          todaySales: aggregatedStats.todaySales,
          totalOrders: aggregatedStats.totalOrders,
          totalRevenue: aggregatedStats.totalSales,
          pendingPayments: aggregatedStats.pendingOrders,
        },
        todayStats: aggregatedStats,
        recentTransactions,
      },
    });
  } catch (error) {
    next(error);
  }
};
