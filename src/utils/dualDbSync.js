import mongoose from 'mongoose';
import { db, isFirestoreReady } from '../config/firebase.js';

// MongoDB Models for resilient background backup & fallback
import Order from '../models/orderModel.js';
import Dish from '../models/dishModel.js';
import Customer from '../models/customerModel.js';
import Coupon from '../models/couponModel.js';
import Table from '../models/tableModel.js';
import Setting from '../models/settingModel.js';
import User from '../models/userModel.js';

/**
 * Sync / Backup Order to MongoDB silently in background
 */
export async function backupOrderToMongo(orderData) {
  try {
    if (mongoose.connection.readyState !== 1) return null;
    const orderId = orderData.orderId || orderData.id || orderData._id;
    if (!orderId) return null;

    // Check if exists in Mongo, then update or create
    const filter = { $or: [{ orderId }, { _id: mongoose.isValidObjectId(orderId) ? orderId : undefined }].filter(f => Object.values(f)[0] !== undefined) };
    if (filter.$or.length === 0) filter.$or = [{ orderId }];

    const updatePayload = {
      orderId,
      user: orderData.user && mongoose.isValidObjectId(orderData.user) ? orderData.user : undefined,
      type: orderData.type || 'Dine-In',
      table: orderData.table || 'Table 1',
      customer: orderData.customer || 'Customer',
      phone: orderData.phone || '',
      paymentStatus: orderData.paymentStatus || 'cash',
      paymentLabel: orderData.paymentLabel || 'Cash',
      status: orderData.status || 'new',
      items: orderData.items || [],
      subtotal: Number(orderData.subtotal) || 0,
      discount: Number(orderData.discount) || 0,
      tax: Number(orderData.tax) || 0,
      total: Number(orderData.total) || 0,
      note: orderData.note || '',
      seen: Boolean(orderData.seen),
      foodypayId: orderData.businessId || orderData.foodypayId || orderData.merchantId || '',
      merchantId: orderData.businessId || orderData.foodypayId || orderData.merchantId || '',
    };

    // Remove undefined
    Object.keys(updatePayload).forEach(k => updatePayload[k] === undefined && delete updatePayload[k]);

    return await Order.findOneAndUpdate(filter, { $set: updatePayload }, { upsert: true, new: true }).catch(() => null);
  } catch (err) {
    // Non-blocking background backup error
    return null;
  }
}

/**
 * Sync / Backup Dish to MongoDB silently in background
 */
export async function backupDishToMongo(dishData) {
  try {
    if (mongoose.connection.readyState !== 1) return null;
    const dishId = dishData.id || dishData._id;
    const name = dishData.name ? String(dishData.name).trim().toUpperCase() : '';
    if (!name) return null;

    const filter = {
      $or: [
        ...(dishId && mongoose.isValidObjectId(dishId) ? [{ _id: dishId }] : []),
        { name, foodypayId: dishData.businessId || dishData.foodypayId }
      ]
    };

    const payload = {
      name,
      category: dishData.category || 'General',
      price: Number(dishData.price) || 0,
      isVeg: dishData.isVeg !== false,
      isSpecial: Boolean(dishData.isSpecial),
      inStock: dishData.inStock !== false,
      desc: dishData.desc || '',
      image: dishData.image || '',
      foodypayId: dishData.businessId || dishData.foodypayId || '',
      merchantId: dishData.businessId || dishData.foodypayId || '',
    };

    return await Dish.findOneAndUpdate(filter, { $set: payload }, { upsert: true, new: true }).catch(() => null);
  } catch (err) {
    return null;
  }
}

/**
 * Backup / Sync Business User to MongoDB
 */
export async function backupUserToMongo(userData) {
  try {
    if (mongoose.connection.readyState !== 1) return null;
    const email = (userData.email || '').toLowerCase().trim();
    const foodypayId = userData.uniqueId || userData.businessId || userData.foodypayId;

    const filter = {
      $or: [
        ...(email ? [{ email }] : []),
        ...(foodypayId ? [{ foodypayId }] : []),
      ]
    };

    if (filter.$or.length === 0) return null;

    const payload = {
      name: userData.businessName || userData.name || 'Restaurant',
      email: email || `${foodypayId || Date.now()}@foodypay.online`,
      phone: userData.phone || '',
      foodypayId: foodypayId || '',
      plan: userData.plan || 'Free',
      startingDate: userData.startingDate,
      expireDate: userData.expireDate,
      isLocked: Boolean(userData.isLocked),
    };

    return await User.findOneAndUpdate(filter, { $set: payload }, { upsert: true, new: true }).catch(() => null);
  } catch (err) {
    return null;
  }
}

/**
 * Unified Multi-Database Fallback Fetcher:
 * 1. Tries Primary Cloud Firestore
 * 2. If Firestore is down/errors, seamlessly retrieves from MongoDB backup cluster
 */
export async function fetchWithMongoFallback({ firestoreFetch, mongoFetch, resourceName = 'data' }) {
  if (isFirestoreReady()) {
    try {
      const fsData = await firestoreFetch();
      if (fsData !== null && fsData !== undefined) {
        return fsData;
      }
    } catch (fsErr) {
      console.warn(`⚠️ Firestore primary fetch failed for ${resourceName} (${fsErr.message}). Switching seamlessly to MongoDB backup...`);
    }
  }

  // Fallback to MongoDB
  try {
    return await mongoFetch();
  } catch (mongoErr) {
    console.error(`❌ MongoDB fallback fetch failed for ${resourceName}:`, mongoErr.message);
    throw mongoErr;
  }
}
