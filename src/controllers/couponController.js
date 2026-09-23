import Coupon from '../models/couponModel.js';

/**
 * @desc    Get all coupons for authenticated user
 * @route   GET /api/coupons
 * @access  Private
 */
export const getCoupons = async (req, res, next) => {
  try {
    const coupons = await Coupon.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json({
      success: true,
      count: coupons.length,
      data: coupons,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create new coupon code
 * @route   POST /api/coupons
 * @access  Private
 */
export const createCoupon = async (req, res, next) => {
  try {
    const { code, discount, minOrder } = req.body;

    if (!code || !discount) {
      res.status(400);
      throw new Error('Please provide coupon code and discount');
    }

    const coupon = await Coupon.create({
      user: req.user._id,
      code: code.trim().toUpperCase(),
      discount,
      minOrder: Number(minOrder) || 199,
      uses: 0,
      status: 'Active',
    });

    res.status(201).json({
      success: true,
      data: coupon,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete coupon
 * @route   DELETE /api/coupons/:id
 * @access  Private
 */
export const deleteCoupon = async (req, res, next) => {
  try {
    const coupon = await Coupon.findOneAndDelete({ _id: req.params.id, user: req.user._id });

    if (!coupon) {
      res.status(404);
      throw new Error('Coupon not found');
    }

    res.json({
      success: true,
      message: 'Coupon deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
