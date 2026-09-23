import Setting from '../models/settingModel.js';

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
        restName: req.user.businessName || req.user.name || "Sharma's Kitchen",
        phone: req.user.contactNo || '',
      });
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

    const {
      storeStatus,
      deliveryStatus,
      pickupStatus,
      storeType,
      restName,
      phone,
      address,
      upiId,
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
