import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema({
  pid: { type: String, default: '' },
  name: { type: String, required: true },
  v: { type: String, default: 'Regular' },
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
    foodypayId: {
      type: String,
      index: true,
      trim: true,
      default: '',
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
      enum: ['new', 'ordering', 'kot_printed', 'bill_printed', 'billed', 'settled', 'preparing', 'ready', 'out_for_delivery', 'dispatched', 'delivered', 'served', 'completed', 'cancelled'],
      default: 'new',
    },
    kotPrinted: {
      type: Boolean,
      default: false,
    },
    printKotRequested: {
      type: Boolean,
      default: false,
    },
    kotPrintRequestedAt: {
      type: String,
      default: '',
    },
    billPrinted: {
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
    waiterId: {
      type: String,
      trim: true,
      default: '',
    },
    waiterName: {
      type: String,
      trim: true,
      default: '',
    },
    placedBy: {
      type: String,
      enum: ['Customer', 'Waiter', 'Counter'],
      default: 'Customer',
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
