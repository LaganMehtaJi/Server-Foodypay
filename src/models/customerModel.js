import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      default: '',
    },
    ordersCount: {
      type: Number,
      default: 1,
    },
    totalSales: {
      type: Number,
      default: 0,
    },
    birthday: {
      type: String,
      default: 'Not Set',
    },
    isBirthdayToday: {
      type: Boolean,
      default: false,
    },
    lastOrdered: {
      type: String,
      default: 'Just now',
    },
  },
  {
    timestamps: true,
  }
);

const Customer = mongoose.model('Customer', customerSchema);

export default Customer;
