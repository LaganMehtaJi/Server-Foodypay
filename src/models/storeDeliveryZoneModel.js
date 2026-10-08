import mongoose from 'mongoose';

const storeDeliveryZoneSchema = new mongoose.Schema(
  {
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
      required: true,
      index: true,
    },
    zoneId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DeliveryZone',
      required: true,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to ensure uniqueness per store and zone pair
storeDeliveryZoneSchema.index({ storeId: 1, zoneId: 1 }, { unique: true });

const StoreDeliveryZone = mongoose.model('StoreDeliveryZone', storeDeliveryZoneSchema);

export default StoreDeliveryZone;
