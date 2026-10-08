import DeliveryZone from '../models/deliveryZoneModel.js';
import StoreDeliveryZone from '../models/storeDeliveryZoneModel.js';

// @desc    Get all delivery zones
// @route   GET /api/delivery/zones
// @access  Public / Admin
export const getDeliveryZones = async (req, res, next) => {
  try {
    const zones = await DeliveryZone.find().sort({ createdAt: -1 });

    // Fetch store counts per zone
    const zonesWithCount = await Promise.all(
      zones.map(async (zone) => {
        const storeCount = await StoreDeliveryZone.countDocuments({
          zoneId: zone._id,
          isActive: true,
        });
        return {
          ...zone.toObject(),
          assignedStoresCount: storeCount,
        };
      })
    );

    res.status(200).json({
      success: true,
      count: zonesWithCount.length,
      data: zonesWithCount,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new delivery zone
// @route   POST /api/delivery/zones
// @access  Admin
export const createDeliveryZone = async (req, res, next) => {
  try {
    const { name, city, state, pincode, centerLatitude, centerLongitude, radius, coveredSectors, isActive } = req.body;

    if (!name || centerLatitude === undefined || centerLongitude === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Name, centerLatitude, and centerLongitude are required',
      });
    }

    const zoneId = `ZONE-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const parsedSectors = Array.isArray(coveredSectors)
      ? coveredSectors
      : typeof coveredSectors === 'string'
      ? coveredSectors.split(',').map((s) => s.trim()).filter(Boolean)
      : [];

    const zone = await DeliveryZone.create({
      zoneId,
      name,
      city: city || 'Mohali',
      state: state || 'Punjab',
      pincode: pincode || '',
      centerLatitude: Number(centerLatitude),
      centerLongitude: Number(centerLongitude),
      radius: Number(radius) || 5,
      coveredSectors: parsedSectors,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
    });

    res.status(201).json({
      success: true,
      data: zone,
      message: 'Delivery zone created successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update delivery zone
// @route   PUT /api/delivery/zones/:id
// @access  Admin
export const updateDeliveryZone = async (req, res, next) => {
  try {
    const { id } = req.params;
    let zone = await DeliveryZone.findById(id);

    if (!zone) {
      zone = await DeliveryZone.findOne({ zoneId: id });
    }

    if (!zone) {
      return res.status(404).json({
        success: false,
        message: 'Delivery zone not found',
      });
    }

    const updatedZone = await DeliveryZone.findByIdAndUpdate(
      zone._id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: updatedZone,
      message: 'Delivery zone updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete delivery zone
// @route   DELETE /api/delivery/zones/:id
// @access  Admin
export const deleteDeliveryZone = async (req, res, next) => {
  try {
    const { id } = req.params;
    let zone = await DeliveryZone.findById(id);

    if (!zone) {
      zone = await DeliveryZone.findOne({ zoneId: id });
    }

    if (!zone) {
      return res.status(404).json({
        success: false,
        message: 'Delivery zone not found',
      });
    }

    await StoreDeliveryZone.deleteMany({ zoneId: zone._id });
    await DeliveryZone.findByIdAndDelete(zone._id);

    res.status(200).json({
      success: true,
      message: 'Delivery zone deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
