import mongoose from 'mongoose';

const tableSchema = new mongoose.Schema(
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
    },
    capacity: {
      type: Number,
      default: 4,
    },
    section: {
      type: String,
      default: 'Indoor Dining',
    },
    purpose: {
      type: String,
      default: 'Contactless Self Ordering',
    },
    theme: {
      type: String,
      enum: ['acrylic', 'luxury', 'neon'],
      default: 'acrylic',
    },
    qrColor: {
      type: String,
      default: '#1E293B',
    },
    cornerColor: {
      type: String,
      default: '#FF5E14',
    },
    logoUrl: {
      type: String,
      default: '',
    },
    url: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['available', 'occupied', 'reserved'],
      default: 'available',
    },
  },
  {
    timestamps: true,
  }
);

const Table = mongoose.model('Table', tableSchema);

export default Table;
