import Review from '../models/reviewModel.js';
import User from '../models/userModel.js';

/**
 * @desc    Get reviews for specific business user / authenticated merchant
 * @route   GET /api/reviews
 * @access  Public / Private
 */
export const getReviews = async (req, res, next) => {
  try {
    let filter = {};

    if (req.user) {
      filter = { user: req.user._id };
    } else {
      const { merchantId, foodypayId, userId } = req.query;
      let targetUser = null;

      const searchId = merchantId || userId;
      if (searchId && searchId !== 'undefined') {
        targetUser = await User.findById(searchId).catch(() => null);
      }
      if (!targetUser && foodypayId && foodypayId !== 'undefined') {
        targetUser = await User.findOne({ foodypayId });
      }

      if (targetUser) {
        filter = { user: targetUser._id };
      } else {
        // No valid merchant user identified: strictly return empty list
        return res.json({ success: true, count: 0, data: [] });
      }
    }

    const reviews = await Review.find(filter).sort({ createdAt: -1 });
    res.json({
      success: true,
      count: reviews.length,
      data: reviews,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create new review/feedback for a specific merchant business
 * @route   POST /api/reviews
 * @access  Public / Private
 */
export const createReview = async (req, res, next) => {
  try {
    const { customerName, customerPhone, rating, feedback, dishOrdered, tableNo, merchantId, foodypayId, userId } = req.body;

    if (!customerName || !rating) {
      res.status(400);
      throw new Error('Customer name and rating are required');
    }

    let targetUser = req.user || null;

    if (!targetUser) {
      const searchId = merchantId || userId || req.query.merchantId;
      if (searchId && searchId !== 'undefined') {
        targetUser = await User.findById(searchId).catch(() => null);
      }
      if (!targetUser && foodypayId && foodypayId !== 'undefined') {
        targetUser = await User.findOne({ foodypayId });
      }
    }

    if (!targetUser) {
      res.status(400);
      throw new Error('Merchant business ID is required to post a review.');
    }

    const ratingVal = Number(rating) || 5;
    const sentiment = ratingVal >= 4 ? 'positive' : ratingVal === 3 ? 'neutral' : 'negative';

    const review = await Review.create({
      user: targetUser._id,
      customerName: customerName.trim(),
      customerPhone: customerPhone ? customerPhone.trim() : '',
      rating: ratingVal,
      feedback: feedback ? feedback.trim() : '',
      dishOrdered: dishOrdered ? dishOrdered.trim() : 'Table Order',
      tableNo: tableNo || 'Table 1',
      sentiment,
    });

    res.status(201).json({
      success: true,
      data: review,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Reply to a review
 * @route   PUT /api/reviews/:id/reply
 * @access  Private
 */
export const replyToReview = async (req, res, next) => {
  try {
    const { reply } = req.body;
    const review = await Review.findById(req.params.id);

    if (!review) {
      res.status(404);
      throw new Error('Review not found');
    }

    review.reply = reply;
    await review.save();

    res.json({
      success: true,
      data: review,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete a review
 * @route   DELETE /api/reviews/:id
 * @access  Private / Admin
 */
export const deleteReview = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review) {
      res.status(404);
      throw new Error('Review not found');
    }

    if (req.user && review.user && review.user.toString() !== req.user._id.toString()) {
      res.status(403);
      throw new Error('Not authorized to delete this review');
    }

    await Review.deleteOne({ _id: req.params.id });

    res.json({
      success: true,
      message: 'Review deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
