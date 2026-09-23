/**
 * @desc    Get dashboard metrics & user details
 * @route   GET /api/dashboard
 * @access  Private (JWT Protected)
 */
export const getDashboardData = async (req, res, next) => {
  try {
    const user = req.user;

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
          totalOrders: 142,
          totalRevenue: 25400,
          pendingPayments: 3,
          activeTables: 8,
        },
        recentTransactions: [
          { id: 'TXN-101', customer: 'Rahul Sharma', amount: 450, status: 'Paid', time: '10 mins ago' },
          { id: 'TXN-102', customer: 'Priya Verma', amount: 1200, status: 'Paid', time: '25 mins ago' },
          { id: 'TXN-103', customer: 'Amit Kumar', amount: 890, status: 'Pending', time: '1 hour ago' },
        ],
      },
    });
  } catch (error) {
    next(error);
  }
};
