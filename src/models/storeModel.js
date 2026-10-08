import mongoose from 'mongoose';

const storeSchema = new mongoose.Schema(
  {
    storeId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Please enter store name'],
      trim: true,
    },
    ownerName: {
      type: String,
      default: '',
      trim: true,
    },
    ownerEmail: {
      type: String,
      required: [true, 'Please provide store owner email'],
      lowercase: true,
      trim: true,
      index: true,
    },
    gstNumber: {
      type: String,
      default: '',
      trim: true,
    },
    licenseNumber: {
      type: String,
      default: '',
      trim: true,
    },
    address: {
      type: String,
      required: [true, 'Please enter store address'],
      trim: true,
    },
    city: {
      type: String,
      required: [true, 'Please enter city'],
      trim: true,
      index: true,
    },
    state: {
      type: String,
      default: '',
      trim: true,
    },
    pincode: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    latitude: {
      type: Number,
      required: [true, 'Please enter store latitude'],
    },
    longitude: {
      type: Number,
      required: [true, 'Please enter store longitude'],
    },
    deliveryRadius: {
      type: Number,
      required: [true, 'Please enter store delivery radius in KM'],
      default: 5,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    documents: [
      {
        url: { type: String, default: '' },
        name: { type: String, default: '' },
      },
    ],
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

storeSchema.index({ latitude: 1, longitude: 1 });

const Store = mongoose.model('Store', storeSchema);

export default Store;
