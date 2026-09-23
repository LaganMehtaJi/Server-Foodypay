import Review from '../models/reviewModel.js';

/**
 * @desc    Get all reviews
 * @route   GET /api/reviews
 * @access  Public / Private
 */
export const getReviews = async (req, res, next) => {
  try {
    const reviews = await Review.find({}).sort({ createdAt: -1 });
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
 * @desc    Create new review/feedback
 * @route   POST /api/reviews
 * @access  Public
 */
export const createReview = async (req, res, next) => {
  try {
    const { customerName, customerPhone, rating, feedback, dishOrdered, tableNo } = req.body;

    if (!customerName || !rating) {
      res.status(400);
      throw new Error('Customer name and rating are required');
    }

    const ratingVal = Number(rating) || 5;
    const sentiment = ratingVal >= 4 ? 'positive' : ratingVal === 3 ? 'neutral' : 'negative';

    const review = await Review.create({
      user: req.user ? req.user._id : null,
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
