import DeliveryZone from '../models/deliveryZoneModel.js';
import Store from '../models/storeModel.js';
import StoreDeliveryZone from '../models/storeDeliveryZoneModel.js';
import Dish from '../models/dishModel.js';
import { calculateDistanceKm } from '../utils/geoUtils.js';

// @desc    Check delivery availability based on customer latitude & longitude
// @route   GET /api/customer/delivery-availability
// @access  Public
export const checkDeliveryAvailability = async (req, res, next) => {
  try {
    const { lat, lng } = req.query;

    if (!lat || !lng || isNaN(Number(lat)) || isNaN(Number(lng))) {
      return res.status(400).json({
        available: false,
        reason: 'INVALID_COORDINATES',
        message: 'Valid latitude and longitude parameters are required.',
      });
    }

    const customerLat = Number(lat);
    const customerLng = Number(lng);

    // 1. Fetch all active delivery zones
    const activeZones = await DeliveryZone.find({ isActive: true });

    if (activeZones.length === 0) {
      return res.status(200).json({
        available: false,
        reason: 'AREA_NOT_SUPPORTED',
        message: 'Sorry, home delivery is currently not available in your area.',
        eligibleStores: [],
      });
    }

    // 2. Find matching active zones for customer location
    const matchingZones = activeZones.filter((zone) => {
      const dist = calculateDistanceKm(
        customerLat,
        customerLng,
        zone.centerLatitude,
        zone.centerLongitude
      );
      return dist <= zone.radius;
    });

    const matchingZoneIds = matchingZones.map((z) => z._id);

    // 3. Fetch active stores
    const activeStores = await Store.find({ isActive: true });

    // 4. Filter stores by both Zone Check and Radius Check
    const eligibleStores = [];

    for (const store of activeStores) {
      const distToStore = calculateDistanceKm(
        customerLat,
        customerLng,
        store.latitude,
        store.longitude
      );

      // Check Store Radius
      const isWithinRadius = distToStore <= store.deliveryRadius;

      // Check Store Delivery Zones mapping
      let isZoneMatched = false;

      if (matchingZoneIds.length > 0) {
        const zoneMapping = await StoreDeliveryZone.findOne({
          storeId: store._id,
          zoneId: { $in: matchingZoneIds },
          isActive: true,
        });
        if (zoneMapping) {
          isZoneMatched = true;
        }
      }

      // Store is eligible if within radius AND zone matches (or if radius matches and no zones defined yet)
      if (isWithinRadius && (isZoneMatched || matchingZoneIds.length === 0)) {
        eligibleStores.push({
          ...store.toObject(),
          distanceKm: distToStore,
        });
      }
    }

    if (eligibleStores.length === 0) {
      return res.status(200).json({
        available: false,
        reason: 'AREA_NOT_SUPPORTED',
        message: 'Sorry, home delivery is currently not available in your area.',
        matchingZones,
        eligibleStores: [],
      });
    }

    return res.status(200).json({
      available: true,
      message: 'Delivery available in your area!',
      matchingZones,
      eligibleStores,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get available products for customer location
// @route   GET /api/customer/available-products
// @access  Public
export const getAvailableProducts = async (req, res, next) => {
  try {
    const { lat, lng, category } = req.query;

    // If no coordinates provided, fallback to returning all active dishes for browsing
    if (!lat || !lng || isNaN(Number(lat)) || isNaN(Number(lng))) {
      const query = { inStock: true };
      if (category && category !== 'All') {
        query.category = category;
      }
      const dishes = await Dish.find(query).sort({ createdAt: -1 });

      return res.status(200).json({
        available: true,
        isLocationProvided: false,
        message: 'Showing all available products.',
        dishes,
      });
    }

    const customerLat = Number(lat);
    const customerLng = Number(lng);

    // 1. Check availability
    const activeZones = await DeliveryZone.find({ isActive: true });
    const activeStores = await Store.find({ isActive: true });

    const matchingZones = activeZones.filter((zone) => {
      const dist = calculateDistanceKm(
        customerLat,
        customerLng,
        zone.centerLatitude,
        zone.centerLongitude
      );
      return dist <= zone.radius;
    });
    const matchingZoneIds = matchingZones.map((z) => z._id);

    const eligibleStoreIds = [];
    const eligibleStores = [];

    for (const store of activeStores) {
      const distToStore = calculateDistanceKm(
        customerLat,
        customerLng,
        store.latitude,
        store.longitude
      );

      const isWithinRadius = distToStore <= store.deliveryRadius;

      let isZoneMatched = false;
      if (matchingZoneIds.length > 0) {
        const zoneMapping = await StoreDeliveryZone.findOne({
          storeId: store._id,
          zoneId: { $in: matchingZoneIds },
          isActive: true,
        });
        if (zoneMapping) isZoneMatched = true;
      }

      if (isWithinRadius && (isZoneMatched || matchingZoneIds.length === 0)) {
        eligibleStoreIds.push(store._id);
        eligibleStores.push({
          ...store.toObject(),
          distanceKm: distToStore,
        });
      }
    }

    // If active zones or active stores exist but none cover this customer location
    if ((activeZones.length > 0 || activeStores.length > 0) && eligibleStores.length === 0) {
      return res.status(200).json({
        available: false,
        reason: 'AREA_NOT_SUPPORTED',
        message: 'Sorry, home delivery is currently not available in your area.',
        dishes: [],
        eligibleStores: [],
      });
    }

    // 2. Fetch dishes matching eligible stores (or general dishes if storeId not linked)
    const dishQuery = { inStock: true };
    if (eligibleStoreIds.length > 0) {
      dishQuery.$or = [
        { storeId: { $in: eligibleStoreIds } },
        { storeId: { $exists: false } },
        { storeId: null },
      ];
    }
    if (category && category !== 'All') {
      dishQuery.category = category;
    }

    const dishes = await Dish.find(dishQuery).sort({ createdAt: -1 });

    return res.status(200).json({
      available: true,
      isLocationProvided: true,
      message: 'Products loaded successfully for your location.',
      matchingZones,
      eligibleStores,
      dishes,
    });
  } catch (error) {
    next(error);
  }
};
