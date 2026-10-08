import Coupon from '../models/couponModel.js';
import User from '../models/userModel.js';

/**
 * @desc    Get all coupons for authenticated user (Dashboard Merchant)
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
 * @desc    Get coupons assigned to a specific customer or public active store coupons
 * @route   GET /api/coupons/public
 * @access  Public
 */
export const getPublicCustomerCoupons = async (req, res, next) => {
  try {
    const { phone, email, merchantId, foodypayId } = req.query;

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

    const cleanPhone = (phone || '').trim();
    const cleanEmail = (email || '').trim().toLowerCase();

    // Query active coupons that are assignedToAll OR assigned specifically to matching phone/email
    const filterConditions = {
      ...userQuery,
      status: 'Active',
      $or: [
        { assignedToAll: true },
        ...(cleanPhone ? [{ assignedCustomerPhone: { $regex: cleanPhone, $options: 'i' } }] : []),
        ...(cleanEmail ? [{ assignedCustomerEmail: cleanEmail }] : []),
      ],
    };

    const coupons = await Coupon.find(filterConditions).sort({ createdAt: -1 });

    // Exclude expired ones by date
    const now = new Date();
    const validCoupons = coupons.filter(c => !c.expiryDate || new Date(c.expiryDate) >= now);

    res.json({
      success: true,
      count: validCoupons.length,
      data: validCoupons,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create new coupon code with optional customer assignment
 * @route   POST /api/coupons
 * @access  Private
 */
export const createCoupon = async (req, res, next) => {
  try {
    const {
      code,
      discount,
      minOrder,
      discountValue,
      type,
      assignedToAll,
      assignedCustomerPhone,
      assignedCustomerEmail,
      assignedCustomerName,
      description,
      expiryDate,
    } = req.body;

    if (!code || !discount) {
      res.status(400);
      throw new Error('Please provide coupon code and discount description');
    }

    const coupon = await Coupon.create({
      user: req.user._id,
      code: code.trim().toUpperCase(),
      discount,
      discountValue: Number(discountValue) || 0,
      type: type || 'percentage',
      minOrder: Number(minOrder) || 199,
      uses: 0,
      status: 'Active',
      assignedToAll: assignedToAll !== undefined ? Boolean(assignedToAll) : true,
      assignedCustomerPhone: (assignedCustomerPhone || '').trim(),
      assignedCustomerEmail: (assignedCustomerEmail || '').trim().toLowerCase(),
      assignedCustomerName: (assignedCustomerName || '').trim(),
      description: (description || '').trim(),
      expiryDate: expiryDate ? new Date(expiryDate) : undefined,
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
