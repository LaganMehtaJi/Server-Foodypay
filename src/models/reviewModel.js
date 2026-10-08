import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    customerName: {
      type: String,
      required: [true, 'Please enter customer name'],
      trim: true,
    },
    customerPhone: {
      type: String,
      default: '',
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      default: 5,
    },
    feedback: {
      type: String,
      default: '',
    },
    dishOrdered: {
      type: String,
      default: '',
    },
    tableNo: {
      type: String,
      default: 'Table 1',
    },
    sentiment: {
      type: String,
      enum: ['positive', 'neutral', 'negative'],
      default: 'positive',
    },
    reply: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const Review = mongoose.model('Review', reviewSchema);
export default Review;
