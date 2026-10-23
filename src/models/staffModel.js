import mongoose from 'mongoose';

const staffSchema = new mongoose.Schema(
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
      required: true,
    },
    employeeId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    duty: {
      type: String,
      enum: ['Waiter', 'Cook', 'Chef', 'Cashier', 'Manager', 'Delivery', 'Captain', 'Other'],
      default: 'Waiter',
      index: true,
    },
    pin: {
      type: String,
      trim: true,
      default: '1234',
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive', 'On Leave'],
      default: 'Active',
    },
    assignedTables: {
      type: [String],
      default: [],
    },
    avatar: {
      type: String,
      default: '',
    },
    notes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

staffSchema.index({ foodypayId: 1, employeeId: 1 }, { unique: true });

const Staff = mongoose.model('Staff', staffSchema);

export default Staff;
