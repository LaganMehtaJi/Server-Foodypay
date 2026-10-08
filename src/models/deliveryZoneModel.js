import mongoose from 'mongoose';

const deliveryZoneSchema = new mongoose.Schema(
  {
    zoneId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Please enter zone name'],
      trim: true,
    },
    city: {
      type: String,
      required: [true, 'Please enter city'],
      trim: true,
      index: true,
    },
    state: {
      type: String,
      default: '',
      trim: true,
    },
    pincode: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    centerLatitude: {
      type: Number,
      required: [true, 'Please enter center latitude'],
    },
    centerLongitude: {
      type: Number,
      required: [true, 'Please enter center longitude'],
    },
    radius: {
      type: Number,
      required: [true, 'Please enter delivery zone radius in KM'],
      default: 5,
    },
    coveredSectors: {
      type: [String],
      default: [],
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

deliveryZoneSchema.index({ centerLatitude: 1, centerLongitude: 1 });

const DeliveryZone = mongoose.model('DeliveryZone', deliveryZoneSchema);

export default DeliveryZone;
