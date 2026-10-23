import Dish from '../models/dishModel.js';
import User from '../models/userModel.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../utils/cloudinaryUpload.js';

/**
 * @desc    Get all dishes for authenticated user or public merchant
 * @route   GET /api/dishes
 * @access  Private / Public (with foodypayId or merchantId)
 */
export const getDishes = async (req, res, next) => {
  try {
    let filter = {};
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 500;
    const skip = (page - 1) * limit;

    const bId = (req.user?.foodypayId || req.user?._id || req.query?.foodypayId || req.query?.merchantId || req.query?.businessId || '').toString().trim().toUpperCase();

    if (req.user) {
      filter = { $or: [{ user: req.user._id }, { sku: bId }] };
    } else if (bId) {
      // Find user by foodypayId
      const targetUser = await User.findOne({
        $or: [{ foodypayId: bId }, { uniqueId: bId }, { email: bId.toLowerCase() }]
      }).catch(() => null);

      if (targetUser) {
        filter = { user: targetUser._id };
      } else {
        filter = { sku: bId };
      }
    }

    // Fetch strictly from Database (No Firebase)
    const total = await Dish.countDocuments(filter).catch(() => 0);
    const dishes = await Dish.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .catch(() => []);

    // Format for frontend compatibility (ensure id, _id, sizes variants, etc.)
    const formattedDishes = dishes.map((d) => ({
      ...d,
      id: d._id.toString(),
      _id: d._id.toString(),
      variantsCount: Array.isArray(d.sizes) && d.sizes.length > 0 ? d.sizes.length : (d.variantsCount || 1),
    }));

    res.json({
      success: true,
      source: 'database_primary',
      count: formattedDishes.length,
      total,
      totalPages: Math.ceil(total / limit) || 1,
      currentPage: page,
      data: formattedDishes,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create new dish in catalog
 * @route   POST /api/dishes
 * @access  Private / Public with businessId
 */
export const createDish = async (req, res, next) => {
  try {
    const {
      name,
      category,
      price,
      originalPrice,
      showDiscountTag,
      isVeg,
      isSpecial,
      desc,
      variantsCount,
      imageUrl,
      sizes,
      customizations,
      images,
    } = req.body;

    if (!name || price === undefined) {
      res.status(400);
      throw new Error('Please provide name and price for the dish');
    }

    let image = { url: imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&auto=format&fit=crop&q=80', public_id: '' };

    if (req.file) {
      image = await uploadToCloudinary(req.file.buffer, 'foodypay_dishes');
    }

    let parsedSizes = [];
    let parsedCustomizations = [];
    let parsedImages = [];
    try {
      if (sizes) parsedSizes = typeof sizes === 'string' ? JSON.parse(sizes) : sizes;
      if (customizations) parsedCustomizations = typeof customizations === 'string' ? JSON.parse(customizations) : customizations;
      if (images) parsedImages = typeof images === 'string' ? JSON.parse(images) : images;
    } catch {}

    const bId = (req.user?.foodypayId || req.body?.foodypayId || req.body?.merchantId || req.body?.businessId || 'FP-DEFAULT').toString().trim().toUpperCase();

    // Determine user association
    let userId = req.user?._id;
    if (!userId) {
      const u = await User.findOne({
        $or: [{ foodypayId: bId }, { uniqueId: bId }]
      }).catch(() => null);
      if (u) userId = u._id;
    }

    const dishPayload = {
      user: userId || '000000000000000000000000',
      sku: bId,
      name: name.trim().toUpperCase(),
      category: (category || 'Fast Food').trim(),
      price: Number(price) || 0,
      originalPrice: Number(originalPrice) || 0,
      showDiscountTag: showDiscountTag !== false,
      isVeg: isVeg === 'false' || isVeg === false ? false : true,
      isPinned: isSpecial === 'true' || isSpecial === true,
      desc: desc || 'Prepared fresh with high quality ingredients.',
      variantsCount: Array.isArray(parsedSizes) && parsedSizes.length > 0 ? parsedSizes.length : (Number(variantsCount) || 1),
      image,
      images: parsedImages.length > 0 ? parsedImages.map(img => typeof img === 'string' ? { url: img, public_id: '' } : img) : [{ url: image.url, public_id: '' }],
      sizes: parsedSizes.map(s => ({ name: s.name, price: Number(s.price) || 0 })),
      customizations: parsedCustomizations,
      inStock: true,
      isActive: true,
    };

    // Save strictly to Database (MongoDB) - No Firebase
    const mongoDish = await Dish.create(dishPayload);

    res.status(201).json({
      success: true,
      message: 'Product created successfully in database',
      data: {
        ...mongoDish.toObject(),
        id: mongoDish._id.toString(),
        _id: mongoDish._id.toString(),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update dish
 * @route   PUT /api/dishes/:id
 * @access  Private / Public
 */
export const updateDish = async (req, res, next) => {
  try {
    const dishId = req.params.id;
    let dish = await Dish.findById(dishId).catch(() => null);

    if (!dish) {
      // Try finding by custom id or sku
      dish = await Dish.findOne({ sku: dishId }).catch(() => null);
    }

    if (!dish) {
      res.status(404);
      throw new Error(`Product not found with ID: ${dishId}`);
    }

    if (req.file) {
      if (dish.image && dish.image.public_id) {
        await deleteFromCloudinary(dish.image.public_id).catch(() => {});
      }
      const image = await uploadToCloudinary(req.file.buffer, 'foodypay_dishes');
      dish.image = image;
    } else if (req.body.imageUrl) {
      dish.image = { url: req.body.imageUrl, public_id: '' };
    }

    if (req.body.name) dish.name = req.body.name.trim().toUpperCase();
    if (req.body.category) dish.category = req.body.category.trim();
    if (req.body.price !== undefined) dish.price = Number(req.body.price);
    if (req.body.originalPrice !== undefined) dish.originalPrice = Number(req.body.originalPrice);
    if (req.body.showDiscountTag !== undefined) dish.showDiscountTag = Boolean(req.body.showDiscountTag);
    if (req.body.isVeg !== undefined) dish.isVeg = req.body.isVeg === 'false' || req.body.isVeg === false ? false : Boolean(req.body.isVeg);
    if (req.body.isSpecial !== undefined) dish.isPinned = Boolean(req.body.isSpecial);
    if (req.body.desc !== undefined) dish.desc = req.body.desc;

    // Variants / Sizes
    if (req.body.sizes) {
      try {
        const parsed = typeof req.body.sizes === 'string' ? JSON.parse(req.body.sizes) : req.body.sizes;
        dish.sizes = Array.isArray(parsed) ? parsed.map(s => ({ name: s.name, price: Number(s.price) || 0 })) : [];
        dish.variantsCount = dish.sizes.length || 1;
      } catch {}
    }

    // Customizations
    if (req.body.customizations) {
      try {
        const parsed = typeof req.body.customizations === 'string' ? JSON.parse(req.body.customizations) : req.body.customizations;
        dish.customizations = Array.isArray(parsed) ? parsed : [];
      } catch {}
    }

    // Images
    if (req.body.images) {
      try {
        const parsed = typeof req.body.images === 'string' ? JSON.parse(req.body.images) : req.body.images;
        if (Array.isArray(parsed) && parsed.length > 0) {
          dish.images = parsed.map(img => typeof img === 'string' ? { url: img, public_id: '' } : img);
        }
      } catch {}
    }

    await dish.save();

    res.json({
      success: true,
      message: 'Product updated successfully in database',
      data: {
        ...dish.toObject(),
        id: dish._id.toString(),
        _id: dish._id.toString(),
      },
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
    const dish = await Dish.findById(req.params.id);

    if (!dish) {
      res.status(404);
      throw new Error('Dish not found');
    }

    dish.inStock = !dish.inStock;
    await dish.save();

    res.json({
      success: true,
      message: `Dish stock updated to ${dish.inStock ? 'In Stock' : 'Sold Out'}`,
      data: {
        ...dish.toObject(),
        id: dish._id.toString(),
        _id: dish._id.toString(),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete dish from catalog
 * @route   DELETE /api/dishes/:id
 * @access  Private
 */
export const deleteDish = async (req, res, next) => {
  try {
    const dish = await Dish.findById(req.params.id);

    if (!dish) {
      res.status(404);
      throw new Error('Dish not found');
    }

    // Delete image from Cloudinary if public_id exists
    if (dish.image && dish.image.public_id) {
      await deleteFromCloudinary(dish.image.public_id).catch(() => {});
    }

    await Dish.deleteOne({ _id: dish._id });

    res.json({
      success: true,
      message: 'Dish deleted successfully from database',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Bulk Migrate / Sync Catalog to Database
 * @route   POST /api/dishes/bulk-migrate
 * @access  Private / Public
 */
export const bulkMigrateDishes = async (req, res, next) => {
  try {
    const { dishes = [], businessId = 'FP-DEFAULT' } = req.body;

    if (!Array.isArray(dishes) || dishes.length === 0) {
      return res.status(400).json({ success: false, message: 'No dishes provided for migration' });
    }

    const bId = (req.user?.foodypayId || businessId).toString().trim().toUpperCase();
    let userId = req.user?._id;
    if (!userId) {
      const u = await User.findOne({
        $or: [{ foodypayId: bId }, { uniqueId: bId }]
      }).catch(() => null);
      if (u) userId = u._id;
    }

    let inserted = 0;
    let updated = 0;

    for (const d of dishes) {
      const name = (d.name || '').trim().toUpperCase();
      if (!name) continue;

      const filter = {
        name,
        $or: [{ sku: bId }, ...(userId ? [{ user: userId }] : [])]
      };

      const parsedSizes = Array.isArray(d.sizes)
        ? d.sizes.map(s => ({ name: s.name, price: Number(s.price) || 0 }))
        : [];

      const updatePayload = {
        user: userId || '000000000000000000000000',
        sku: bId,
        name,
        category: (d.category || 'Fast Food').trim(),
        price: Number(d.price) || 0,
        originalPrice: Number(d.originalPrice) || 0,
        showDiscountTag: d.showDiscountTag !== false,
        isVeg: d.isVeg !== false,
        isPinned: Boolean(d.isSpecial || d.isPinned),
        desc: d.desc || '',
        variantsCount: parsedSizes.length || 1,
        image: typeof d.image === 'string' ? { url: d.image, public_id: '' } : (d.image || { url: '', public_id: '' }),
        images: Array.isArray(d.images) ? d.images.map(img => typeof img === 'string' ? { url: img, public_id: '' } : img) : [],
        sizes: parsedSizes,
        customizations: Array.isArray(d.customizations) ? d.customizations : [],
        inStock: d.inStock !== false,
        isActive: true,
      };

      const result = await Dish.findOneAndUpdate(filter, updatePayload, { upsert: true, new: true, setDefaultsOnInsert: true });
      if (result) {
        inserted++;
      }
    }

    res.json({
      success: true,
      message: `Successfully migrated ${inserted} dishes into database!`,
      count: inserted,
    });
  } catch (error) {
    next(error);
  }
};
