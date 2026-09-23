import Dish from '../models/dishModel.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../utils/cloudinaryUpload.js';

/**
 * @desc    Get all dishes for authenticated user
 * @route   GET /api/dishes
 * @access  Private
 */
export const getDishes = async (req, res, next) => {
  try {
    const filter = req.user ? { user: req.user._id } : {};
    const dishes = await Dish.find(filter).sort({ createdAt: -1 });
    res.json({
      success: true,
      count: dishes.length,
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

    const dish = await Dish.create({
      user: req.user._id,
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
    });

    res.status(201).json({
      success: true,
      data: dish,
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

    res.json({
      success: true,
      message: 'Dish and associated Cloudinary image deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
