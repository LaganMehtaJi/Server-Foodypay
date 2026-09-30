import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  qty: { type: Number, required: true, default: 1 },
  price: { type: Number, required: true },
  isVeg: { type: Boolean, default: true },
});

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    orderId: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['Dine-In', 'Takeaway', 'Home Delivery'],
      default: 'Dine-In',
    },
    table: {
      type: String,
      default: 'Table 1',
    },
    customer: {
      type: String,
      default: 'Walk-in Guest',
    },
    phone: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['new', 'preparing', 'ready', 'completed'],
      default: 'new',
    },
    seen: {
      type: Boolean,
      default: false,
    },
    paymentStatus: {
      type: String,
      default: 'cash',
    },
    paymentLabel: {
      type: String,
      default: 'Cash on Counter',
    },
    items: [orderItemSchema],
    note: {
      type: String,
      default: '',
    },
    subtotal: {
      type: Number,
      required: true,
      default: 0,
    },
    discount: {
      type: Number,
      default: 0,
    },
    tax: {
      type: Number,
      default: 0,
    },
    total: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

const Order = mongoose.model('Order', orderSchema);

export default Order;
