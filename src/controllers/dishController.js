import Dish from '../models/dishModel.js';
import User from '../models/userModel.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../utils/cloudinaryUpload.js';
import { db, isFirestoreReady } from '../config/firebase.js';
import { backupDishToMongo } from '../utils/dualDbSync.js';

/**
 * @desc    Get all dishes for authenticated user or public merchant
 * @route   GET /api/dishes
 * @access  Private / Public (with merchantId or foodypayId)
 */
export const getDishes = async (req, res, next) => {
  try {
    let filter = {};
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const skip = (page - 1) * limit;

    const bId = (req.user?.foodypayId || req.user?._id || req.query?.foodypayId || req.query?.merchantId || '').toString().trim().toUpperCase();

    // 1. PRIMARY: Fetch from Cloud Firestore
    if (isFirestoreReady() && bId) {
      try {
        const snap = await db.collection('dishes')
          .where('businessId', '==', bId)
          .limit(limit)
          .get();

        if (!snap.empty) {
          const fsDishes = [];
          snap.forEach((doc) => {
            const d = doc.data();
            fsDishes.push({ id: doc.id, _id: doc.id, ...d });
            backupDishToMongo(d).catch(() => {});
          });

          return res.json({
            success: true,
            source: 'firestore_primary',
            count: fsDishes.length,
            total: fsDishes.length,
            totalPages: 1,
            currentPage: 1,
            data: fsDishes,
          });
        }
      } catch (fsErr) {
        console.warn('⚠️ Firestore dishes fetch notice, falling back to MongoDB:', fsErr.message);
      }
    }

    if (req.user) {
      filter = { user: req.user._id };
    } else {
      const { merchantId, foodypayId } = req.query;
      let targetUser = null;

      if (merchantId && merchantId !== 'undefined') {
        targetUser = await User.findById(merchantId).catch(() => null);
      }
      if (!targetUser && foodypayId && foodypayId !== 'undefined') {
        targetUser = await User.findOne({ foodypayId }).catch(() => null);
      }

      if (targetUser) {
        filter = { user: targetUser._id };
      } else if (merchantId || foodypayId) {
        // Unknown merchant ID passed: return 0 dishes
        return res.json({ success: true, count: 0, total: 0, totalPages: 0, currentPage: page, data: [] });
      }
    }

    // 2. FALLBACK: Fetch from MongoDB
    const total = await Dish.countDocuments(filter).catch(() => 0);
    const dishes = await Dish.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .catch(() => []);

    res.json({
      success: true,
      source: 'mongo_fallback',
      count: dishes.length,
      total,
      totalPages: Math.ceil(total / limit) || 1,
      currentPage: page,
      data: dishes,
    });
  } catch (error) {
    next(error);
  }
};


/**
 * @desc    Create new dish in catalog
 * @route   POST /api/dishes
 * @access  Private
 */
export const createDish = async (req, res, next) => {
  try {
    const { name, category, price, isVeg, desc, variantsCount, imageUrl, sizes, customizations } = req.body;

    if (!name || !price) {
      res.status(400);
      throw new Error('Please provide name and price for the dish');
    }

    let image = { url: imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&auto=format&fit=crop&q=80', public_id: '' };

    if (req.file) {
      image = await uploadToCloudinary(req.file.buffer, 'foodypay_dishes');
    }

    let parsedSizes = [];
    let parsedCustomizations = [];
    try {
      if (sizes) parsedSizes = typeof sizes === 'string' ? JSON.parse(sizes) : sizes;
      if (customizations) parsedCustomizations = typeof customizations === 'string' ? JSON.parse(customizations) : customizations;
    } catch (e) {}

    const bId = (req.user?.foodypayId || req.user?._id || '').toString().trim().toUpperCase();
    const dishId = `prod_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const dishPayload = {
      id: dishId,
      _id: dishId,
      businessId: bId,
      foodypayId: bId,
      merchantId: bId,
      name: name.trim().toUpperCase(),
      category: category || 'Fast Food',
      price: Number(price),
      isVeg: isVeg === 'false' || isVeg === false ? false : true,
      desc: desc || 'Prepared fresh with high quality ingredients.',
      variantsCount: Number(variantsCount) || (parsedSizes.length > 0 ? parsedSizes.length : 1),
      image,
      sizes: parsedSizes,
      customizations: parsedCustomizations,
      inStock: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 1. PRIMARY STORAGE: Save into Cloud Firestore
    let savedInFirestore = false;
    if (isFirestoreReady()) {
      try {
        await db.collection('dishes').doc(dishId).set(dishPayload, { merge: true });
        savedInFirestore = true;
      } catch (fsErr) {
        console.warn('⚠️ Firestore primary dish save warning:', fsErr.message);
      }
    }

    // 2. BACKGROUND BACKUP: Save into MongoDB
    let mongoDish = null;
    try {
      mongoDish = await Dish.create({
        user: req.user._id,
        ...dishPayload,
      });
    } catch (mErr) {
      console.warn('⚠️ MongoDB dish backup notice:', mErr.message);
    }

    res.status(201).json({
      success: true,
      data: mongoDish || dishPayload,
      storage: savedInFirestore ? 'firestore_with_mongo_backup' : 'mongo_fallback',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update dish
 * @route   PUT /api/dishes/:id
 * @access  Private
 */
export const updateDish = async (req, res, next) => {
  try {
    const dish = await Dish.findOne({ _id: req.params.id, user: req.user._id });

    if (!dish) {
      res.status(404);
      throw new Error('Dish not found');
    }

    if (req.file) {
      if (dish.image && dish.image.public_id) {
        await deleteFromCloudinary(dish.image.public_id);
      }
      const image = await uploadToCloudinary(req.file.buffer, 'foodypay_dishes');
      dish.image = image;
    }

    dish.name = req.body.name ? req.body.name.trim().toUpperCase() : dish.name;
    dish.category = req.body.category || dish.category;
    dish.price = req.body.price !== undefined ? Number(req.body.price) : dish.price;
    dish.isVeg = req.body.isVeg !== undefined ? Boolean(req.body.isVeg) : dish.isVeg;
    dish.desc = req.body.desc !== undefined ? req.body.desc : dish.desc;
    if (req.body.sizes) {
      try {
        dish.sizes = typeof req.body.sizes === 'string' ? JSON.parse(req.body.sizes) : req.body.sizes;
      } catch (e) {}
    }
    if (req.body.customizations) {
      try {
        dish.customizations = typeof req.body.customizations === 'string' ? JSON.parse(req.body.customizations) : req.body.customizations;
      } catch (e) {}
    }

    await dish.save();

    // Sync to Firestore
    if (isFirestoreReady()) {
      try {
        await db.collection('dishes').doc(dish._id.toString()).set({
          name: dish.name,
          category: dish.category,
          price: dish.price,
          isVeg: dish.isVeg,
          desc: dish.desc,
          image: dish.image,
          inStock: dish.inStock,
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      } catch (e) {}
    }

    res.json({
      success: true,
      data: dish,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Toggle dish inStock status
 * @route   PATCH /api/dishes/:id/stock
 * @access  Private
 */
export const toggleDishStock = async (req, res, next) => {
  try {
    const dish = await Dish.findOne({ _id: req.params.id, user: req.user._id });

    if (!dish) {
      res.status(404);
      throw new Error('Dish not found');
    }

    dish.inStock = !dish.inStock;
    await dish.save();

    if (isFirestoreReady()) {
      try {
        await db.collection('dishes').doc(dish._id.toString()).update({
          inStock: dish.inStock,
          updatedAt: new Date().toISOString(),
        });
      } catch (e) {}
    }

    res.json({
      success: true,
      data: dish,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete dish from catalog and delete image from Cloudinary
 * @route   DELETE /api/dishes/:id
 * @access  Private
 */
export const deleteDish = async (req, res, next) => {
  try {
    const dish = await Dish.findOne({ _id: req.params.id, user: req.user._id });

    if (!dish) {
      res.status(404);
      throw new Error('Dish not found');
    }

    // Delete image from Cloudinary if public_id exists
    if (dish.image && dish.image.public_id) {
      await deleteFromCloudinary(dish.image.public_id);
    }

    // Delete dish document from MongoDB Atlas
    await Dish.deleteOne({ _id: dish._id });

    // Delete from Firestore
    if (isFirestoreReady()) {
      try {
        await db.collection('dishes').doc(req.params.id.toString()).delete();
      } catch (e) {}
    }

    res.json({
      success: true,
      message: 'Dish and associated Cloudinary image deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
