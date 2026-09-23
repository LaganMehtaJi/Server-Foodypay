import Customer from '../models/customerModel.js';

/**
 * @desc    Get all customers for authenticated user
 * @route   GET /api/customers
 * @access  Private
 */
export const getCustomers = async (req, res, next) => {
  try {
    const customers = await Customer.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json({
      success: true,
      count: customers.length,
      data: customers,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create new customer
 * @route   POST /api/customers
 * @access  Private
 */
export const createCustomer = async (req, res, next) => {
  try {
    const { name, phone, birthday } = req.body;

    if (!name) {
      res.status(400);
      throw new Error('Please provide customer name');
    }

    const customer = await Customer.create({
      user: req.user._id,
      name,
      phone: phone || '',
      birthday: birthday || 'Not Set',
      ordersCount: 1,
      totalSales: 0,
    });

    res.status(201).json({
      success: true,
      data: customer,
    });
  } catch (error) {
    next(error);
  }
};
