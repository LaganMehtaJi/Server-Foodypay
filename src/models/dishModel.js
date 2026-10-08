import mongoose from 'mongoose';

const dishSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
      index: true,
    },
    sku: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Please enter dish name'],
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'Please enter dish category'],
      default: 'Fast Food',
    },
    price: {
      type: Number,
      required: [true, 'Please enter dish price'],
      default: 0,
    },
    originalPrice: {
      type: Number,
      default: 0,
    },
    showDiscountTag: {
      type: Boolean,
      default: true,
    },
    isVeg: {
      type: Boolean,
      default: true,
    },
    variantsCount: {
      type: Number,
      default: 1,
    },
    inStock: {
      type: Boolean,
      default: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    desc: {
      type: String,
      default: '',
    },
    image: {
      url: { type: String, default: '' },
      public_id: { type: String, default: '' },
    },
    images: [
      {
        url: { type: String, default: '' },
        public_id: { type: String, default: '' },
      },
    ],
    isPinned: {
      type: Boolean,
      default: false,
    },
    sizes: [
      {
        name: { type: String, required: true },
        price: { type: Number, required: true },
      },
    ],
    customizations: [
      {
        title: { type: String, default: 'Customization' },
        options: [
          {
            name: { type: String, required: true },
            price: { type: Number, default: 0 },
          },
        ],
      },
    ],
  },
  {
    timestamps: true,
  }
);

const Dish = mongoose.model('Dish', dishSchema);

export default Dish;
