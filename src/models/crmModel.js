import mongoose from 'mongoose';

const crmCatalogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    foodypayId: {
      type: String,
      index: true,
      trim: true,
      default: '',
    },
    categories: {
      type: [String],
      default: [],
    },
    products: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    areas: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    lastSyncedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

const crmDailySummarySchema = new mongoose.Schema(
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
    date: {
      type: String,
      required: true,
      index: true,
    },
    totalRevenue: {
      type: Number,
      default: 0,
    },
    ordersCount: {
      type: Number,
      default: 0,
    },
    cashTotal: {
      type: Number,
      default: 0,
    },
    upiTotal: {
      type: Number,
      default: 0,
    },
    cardTotal: {
      type: Number,
      default: 0,
    },
    dueTotal: {
      type: Number,
      default: 0,
    },
    lastSyncedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

crmDailySummarySchema.index({ user: 1, date: 1 }, { unique: true });

export const CrmCatalog = mongoose.model('CrmCatalog', crmCatalogSchema);
export const CrmDailySummary = mongoose.model('CrmDailySummary', crmDailySummarySchema);
