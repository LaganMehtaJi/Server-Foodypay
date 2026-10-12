import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema({
  name: { type: String, default: 'Item' },
  qty: { type: Number, default: 1 },
  quantity: { type: Number, default: 1 },
  price: { type: Number, default: 0 },
  isVeg: { type: Boolean, default: true },
  image: { type: String, default: '' },
  customizations: { type: Array, default: [] },
}, { _id: false, strict: false });

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
      default: 'new',
    },
    billPrinted: {
      type: Boolean,
      default: false,
    },
    isPaid: {
      type: Boolean,
      default: false,
    },
    tableCleared: {
      type: Boolean,
      default: false,
    },
    address: {
      type: String,
      default: '',
    },
    paymentMode: {
      type: String,
      default: 'Cash',
    },
    seen: {
      type: Boolean,
      default: false,
    },
    sentToKitchen: {
      type: Boolean,
      default: false,
    },
    kitchenSeen: {
      type: Boolean,
      default: false,
    },
    hasPendingKot: {
      type: Boolean,
      default: false,
    },
    kitchenSentAt: {
      type: Date,
    },
    businessId: {
      type: String,
      default: '',
    },
    merchantId: {
      type: String,
      default: '',
    },
    foodypayId: {
      type: String,
      default: '',
    },
    merchantFilter: {
      type: String,
      default: '',
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
