import mongoose from 'mongoose';

const couponSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    code: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    discount: {
      type: String,
      required: true,
    },
    discountValue: {
      type: Number,
      default: 0,
    },
    type: {
      type: String,
      default: 'percentage',
    },
    minOrder: {
      type: Number,
      default: 199,
    },
    uses: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['Active', 'Expired'],
      default: 'Active',
    },
    assignedToAll: {
      type: Boolean,
      default: true,
    },
    assignedCustomerPhone: {
      type: String,
      trim: true,
      default: '',
    },
    assignedCustomerEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },
    assignedCustomerName: {
      type: String,
      trim: true,
      default: '',
    },
    description: {
      type: String,
      default: '',
    },
    expiryDate: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

const Coupon = mongoose.model('Coupon', couponSchema);

export default Coupon;
