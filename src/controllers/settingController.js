import Setting from '../models/settingModel.js';
import User from '../models/userModel.js';
import { uploadToCloudinary } from '../utils/cloudinaryUpload.js';

/**
 * @desc    Get store settings & credits balance for authenticated user
 * @route   GET /api/settings
 * @access  Private
 */
export const getSettings = async (req, res, next) => {
  try {
    let setting = await Setting.findOne({ user: req.user._id });

    if (!setting) {
      setting = await Setting.create({
        user: req.user._id,
        restName: req.user.businessName || (req.user.name ? `${req.user.name}'s Restaurant` : 'My POS Outlet'),
        phone: req.user.contactNo || '',
      });
    } else if (req.user.businessName && (!setting.restName || setting.restName === 'Lagan Da Dhaba' || setting.restName === 'My Restaurant' || setting.restName === "Sharma's Kitchen")) {
      setting.restName = req.user.businessName;
      if (req.user.contactNo) setting.phone = req.user.contactNo;
      await setting.save();
    }

    res.json({
      success: true,
      data: setting,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update store settings
 * @route   PUT /api/settings
 * @access  Private
 */
export const updateSettings = async (req, res, next) => {
  try {
    let setting = await Setting.findOne({ user: req.user._id });

    if (!setting) {
      setting = new Setting({ user: req.user._id });
    }

    if (req.file) {
      const logoData = await uploadToCloudinary(req.file.buffer, 'foodypay_logos');
      setting.logo = logoData;
      await User.findByIdAndUpdate(req.user._id, { logo: logoData });
    }

    const {
      storeStatus,
      deliveryStatus,
      pickupStatus,
      storeType,
      restName,
      phone,
      address,
      upiId,
      paymentRoutingMode,
      razorpayKeyId,
      razorpayKeySecret,
      gstPercent,
      creditsBalance,
    } = req.body;

    if (storeStatus !== undefined) setting.storeStatus = Boolean(storeStatus);
    if (deliveryStatus !== undefined) setting.deliveryStatus = Boolean(deliveryStatus);
    if (pickupStatus !== undefined) setting.pickupStatus = Boolean(pickupStatus);
    if (storeType !== undefined) setting.storeType = storeType;
    if (restName !== undefined) setting.restName = restName;
    if (phone !== undefined) setting.phone = phone;
    if (address !== undefined) setting.address = address;
    if (upiId !== undefined) setting.upiId = upiId;
    if (paymentRoutingMode !== undefined) setting.paymentRoutingMode = paymentRoutingMode;
    if (razorpayKeyId !== undefined) setting.razorpayKeyId = razorpayKeyId;
    if (razorpayKeySecret !== undefined) setting.razorpayKeySecret = razorpayKeySecret;
    if (gstPercent !== undefined) setting.gstPercent = Number(gstPercent);
    if (creditsBalance !== undefined) setting.creditsBalance = Number(creditsBalance);

    await setting.save();

    res.json({
      success: true,
      data: setting,
    });
  } catch (error) {
    next(error);
  }
};
