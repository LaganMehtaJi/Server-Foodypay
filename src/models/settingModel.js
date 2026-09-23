import mongoose from 'mongoose';

const settingSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    storeStatus: {
      type: Boolean,
      default: true,
    },
    deliveryStatus: {
      type: Boolean,
      default: true,
    },
    pickupStatus: {
      type: Boolean,
      default: true,
    },
    storeType: {
      type: String,
      default: 'Business to Customer (B2C)',
    },
    restName: {
      type: String,
      default: '',
    },
    phone: {
      type: String,
      default: '',
    },
    address: {
      type: String,
      default: '',
    },
    upiId: {
      type: String,
      default: '',
    },
    gstPercent: {
      type: Number,
      default: 5,
    },
    creditsBalance: {
      type: Number,
      default: 2450,
    },
    logo: {
      url: { type: String, default: '' },
      public_id: { type: String, default: '' },
    },
  },
  {
    timestamps: true,
  }
);

const Setting = mongoose.model('Setting', settingSchema);

export default Setting;
