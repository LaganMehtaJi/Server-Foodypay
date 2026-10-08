import Store from '../models/storeModel.js';
import StoreDeliveryZone from '../models/storeDeliveryZoneModel.js';
import DeliveryZone from '../models/deliveryZoneModel.js';
import User from '../models/userModel.js';

// @desc    Get all stores
// @route   GET /api/stores
// @access  Public / Admin
export const getStores = async (req, res, next) => {
  try {
    const { ownerEmail, city, isActive } = req.query;
    const query = {};

    if (ownerEmail) {
      query.ownerEmail = ownerEmail.toLowerCase().trim();
    }
    if (city) {
      query.city = city;
    }
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    const stores = await Store.find(query).sort({ createdAt: -1 });

    // Populate assigned delivery zones for each store
    const storesWithZones = await Promise.all(
      stores.map(async (store) => {
        const storeZones = await StoreDeliveryZone.find({ storeId: store._id, isActive: true })
          .populate('zoneId');
        
        const activeZones = storeZones
          .filter((sz) => sz.zoneId && sz.zoneId.isActive)
          .map((sz) => sz.zoneId);

        return {
          ...store.toObject(),
          deliveryZones: activeZones,
        };
      })
    );

    res.status(200).json({
      success: true,
      count: storesWithZones.length,
      data: storesWithZones,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get store details by ID
// @route   GET /api/stores/:id
// @access  Public / Admin
export const getStoreById = async (req, res, next) => {
  try {
    const { id } = req.params;
    let store = await Store.findById(id);

    if (!store) {
      store = await Store.findOne({ storeId: id });
    }

    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found',
      });
    }

    const storeZones = await StoreDeliveryZone.find({ storeId: store._id, isActive: true })
      .populate('zoneId');
    
    const activeZones = storeZones
      .filter((sz) => sz.zoneId && sz.zoneId.isActive)
      .map((sz) => sz.zoneId);

    res.status(200).json({
      success: true,
      data: {
        ...store.toObject(),
        deliveryZones: activeZones,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Register a new store
// @route   POST /api/stores
// @access  Admin
export const createStore = async (req, res, next) => {
  try {
    const {
      name,
      ownerName,
      ownerEmail,
      gstNumber,
      licenseNumber,
      address,
      city,
      state,
      pincode,
      latitude,
      longitude,
      deliveryRadius,
      deliveryZoneIds,
      isActive,
    } = req.body;

    if (!name || !ownerEmail || !address || !city || latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Name, ownerEmail, address, city, latitude, and longitude are required',
      });
    }

    const storeId = `STORE-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Find optional associated User account by ownerEmail
    const user = await User.findOne({ email: ownerEmail.toLowerCase().trim() });

    const store = await Store.create({
      storeId,
      name,
      ownerName: ownerName || '',
      ownerEmail: ownerEmail.toLowerCase().trim(),
      gstNumber: gstNumber || '',
      licenseNumber: licenseNumber || '',
      address,
      city,
      state: state || 'Punjab',
      pincode: pincode || '',
      latitude: Number(latitude),
      longitude: Number(longitude),
      deliveryRadius: Number(deliveryRadius) || 5,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
      user: user ? user._id : undefined,
    });

    // If deliveryZoneIds provided, associate them in StoreDeliveryZone junction model
    if (Array.isArray(deliveryZoneIds) && deliveryZoneIds.length > 0) {
      const mappings = deliveryZoneIds.map((zoneId) => ({
        storeId: store._id,
        zoneId,
        isActive: true,
      }));
      await StoreDeliveryZone.insertMany(mappings);
    }

    res.status(201).json({
      success: true,
      data: store,
      message: 'Store registered successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update store details
// @route   PUT /api/stores/:id
// @access  Admin / Store Owner
export const updateStore = async (req, res, next) => {
  try {
    const { id } = req.params;
    let store = await Store.findById(id);

    if (!store) {
      store = await Store.findOne({ storeId: id });
    }

    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found',
      });
    }

    const { deliveryZoneIds, ...updateFields } = req.body;

    if (updateFields.ownerEmail) {
      updateFields.ownerEmail = updateFields.ownerEmail.toLowerCase().trim();
      const user = await User.findOne({ email: updateFields.ownerEmail });
      if (user) {
        updateFields.user = user._id;
      }
    }

    const updatedStore = await Store.findByIdAndUpdate(
      store._id,
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    // Update zones if provided
    if (Array.isArray(deliveryZoneIds)) {
      await StoreDeliveryZone.deleteMany({ storeId: store._id });
      if (deliveryZoneIds.length > 0) {
        const mappings = deliveryZoneIds.map((zoneId) => ({
          storeId: store._id,
          zoneId,
          isActive: true,
        }));
        await StoreDeliveryZone.insertMany(mappings);
      }
    }

    res.status(200).json({
      success: true,
      data: updatedStore,
      message: 'Store updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Assign store access to owner email
// @route   POST /api/stores/assign-owner
// @access  Admin
export const assignStoreOwnerEmail = async (req, res, next) => {
  try {
    const { storeId, ownerEmail } = req.body;

    if (!storeId || !ownerEmail) {
      return res.status(400).json({
        success: false,
        message: 'storeId and ownerEmail are required',
      });
    }

    let store = await Store.findById(storeId);
    if (!store) {
      store = await Store.findOne({ storeId });
    }

    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found',
      });
    }

    const cleanEmail = ownerEmail.toLowerCase().trim();
    const user = await User.findOne({ email: cleanEmail });

    store.ownerEmail = cleanEmail;
    if (user) {
      store.user = user._id;
    }
    await store.save();

    res.status(200).json({
      success: true,
      data: store,
      message: `Store access assigned successfully to ${cleanEmail}`,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Assign or sync zones to a store
// @route   POST /api/stores/:storeId/zones
// @access  Admin
export const assignZonesToStore = async (req, res, next) => {
  try {
    const { storeId } = req.params;
    const { zoneIds } = req.body; // Array of DeliveryZone ObjectIds

    let store = await Store.findById(storeId);
    if (!store) {
      store = await Store.findOne({ storeId });
    }

    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found',
      });
    }

    if (!Array.isArray(zoneIds)) {
      return res.status(400).json({
        success: false,
        message: 'zoneIds array is required',
      });
    }

    // Delete previous assignments and re-insert
    await StoreDeliveryZone.deleteMany({ storeId: store._id });
    
    if (zoneIds.length > 0) {
      const mappings = zoneIds.map((zId) => ({
        storeId: store._id,
        zoneId: zId,
        isActive: true,
      }));
      await StoreDeliveryZone.insertMany(mappings);
    }

    res.status(200).json({
      success: true,
      message: 'Store delivery zones updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete store
// @route   DELETE /api/stores/:id
// @access  Admin
export const deleteStore = async (req, res, next) => {
  try {
    const { id } = req.params;
    let store = await Store.findById(id);

    if (!store) {
      store = await Store.findOne({ storeId: id });
    }

    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found',
      });
    }

    await StoreDeliveryZone.deleteMany({ storeId: store._id });
    await Store.findByIdAndDelete(store._id);

    res.status(200).json({
      success: true,
      message: 'Store deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
