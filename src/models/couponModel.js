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
  },
  {
    timestamps: true,
  }
);

const Coupon = mongoose.model('Coupon', couponSchema);

export default Coupon;
