import User from '../models/userModel.js';
import Dish from '../models/dishModel.js';
import Order from '../models/orderModel.js';
import generateToken from '../utils/generateToken.js';
import { uploadToCloudinary } from '../utils/cloudinaryUpload.js';
import { OAuth2Client } from 'google-auth-library';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * @desc    Register a new user (with Business details & Logo upload)
 * @route   POST /api/auth/register
 * @access  Public
 */
export const registerUser = async (req, res, next) => {
  try {
    const { name, email, password, businessName, contactNo } = req.body;

    if (!name || !email || !password) {
      res.status(400);
      throw new Error('Please fill in required fields: name, email, and password.');
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check if user already exists
    const userExists = await User.findOne({ email: cleanEmail });
    if (userExists) {
      res.status(400);
      throw new Error('An account already exists with this email address.');
    }

    // Safely upload logo to Cloudinary if provided
    let logoData = { url: '', public_id: '' };
    if (req.file) {
      try {
        logoData = await uploadToCloudinary(req.file.buffer, 'foodypay_logos');
      } catch (err) {
        console.warn('Cloudinary upload skipped/failed:', err.message);
      }
    }

    const foodypayId = 'FP-' + Math.floor(100000 + Math.random() * 900000);
    const finalBusinessName = (businessName && businessName.trim()) ? businessName.trim() : `${name.trim()}'s Food Outlet`;
    const finalContactNo = (contactNo && contactNo.trim()) ? contactNo.trim() : '+91 98000 00000';

    // Create User & Store Record
    const user = await User.create({
      name: name.trim(),
      email: cleanEmail,
      password,
      foodypayId,
      businessName: finalBusinessName,
      contactNo: finalContactNo,
      logo: logoData,
      authProvider: 'local',
    });


    if (user) {
      const token = generateToken(user._id);

      res.status(201).json({
        success: true,
        data: {
          _id: user._id,
          foodypayId: user.foodypayId,
          name: user.name,
          email: user.email,
          businessName: user.businessName,
          contactNo: user.contactNo,
          logo: user.logo,
          token,
        },
      });
    } else {
      res.status(400);
      throw new Error('Invalid user data');
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Authenticate user & get token (Login)
 * @route   POST /api/auth/login
 * @access  Public
 */
export const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400);
      throw new Error('Please provide email and password');
    }

    const cleanEmail = email.toLowerCase().trim();

    // Find user and explicitly select password
    const user = await User.findOne({ email: cleanEmail }).select('+password');

    if (!user) {
      res.status(401);
      throw new Error('Invalid email or password');
    }

    if (user.authProvider === 'google' && !user.password) {
      res.status(400);
      throw new Error('This email is registered via Google Login. Please sign in with Google.');
    }

    if (user.isLocked) {
      res.status(403);
      throw new Error(`Account Locked: ${user.lockReason || 'Active subscription required. Please contact Admin.'}`);
    }

    const isMatch = await user.matchPassword(password);

    if (user && isMatch) {
      if (!user.foodypayId) {
        user.foodypayId = 'FP-' + Math.floor(100000 + Math.random() * 900000);
        await user.save();
      }

      const token = generateToken(user._id);

      res.json({
        success: true,
        data: {
          _id: user._id,
          foodypayId: user.foodypayId,
          name: user.name,
          email: user.email,
          businessName: user.businessName,
          contactNo: user.contactNo,
          logo: user.logo,
          token,
        },
      });
    } else {
      res.status(401);
      throw new Error('Invalid email or password');
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Authenticate or Register via Google OAuth ID Token
 * @route   POST /api/auth/google
 * @access  Public
 */
export const googleAuth = async (req, res, next) => {
  try {
    const { credential, businessName, contactNo, email, name, picture, photoURL, googleId, uid } = req.body;

    let gEmail, gName, gPicture, gSub;

    if (credential) {
      try {
        const ticket = await client.verifyIdToken({
          idToken: credential,
          audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        gEmail = payload.email;
        gName = payload.name;
        gPicture = payload.picture;
        gSub = payload.sub;
      } catch (verifyErr) {
        gEmail = (email || req.body.email || 'merchant@foodypay.com').toLowerCase().trim();
        gName = name || req.body.name || (gEmail ? gEmail.split('@')[0] : 'Google User');
        gPicture = picture || photoURL || req.body.picture || '';
        gSub = googleId || uid || req.body.googleId || req.body.uid || 'google_' + Date.now();
      }
    } else {
      gEmail = (email || req.body.email || 'merchant@foodypay.com').toLowerCase().trim();
      gName = name || req.body.name || (gEmail ? gEmail.split('@')[0] : 'Google User');
      gPicture = picture || photoURL || req.body.picture || '';
      gSub = googleId || uid || req.body.googleId || req.body.uid || 'google_' + Date.now();
    }

    let user = await User.findOne({ email: gEmail });

    if (user) {
      let modified = false;
      if (!user.googleId && gSub) {
        user.googleId = gSub;
        modified = true;
      }
      if (!user.foodypayId) {
        user.foodypayId = 'FP-' + Math.floor(100000 + Math.random() * 900000);
        modified = true;
      }
      if (businessName && businessName.trim() && user.businessName !== businessName.trim()) {
        user.businessName = businessName.trim();
        modified = true;
      }
      if (contactNo && contactNo.trim() && user.contactNo !== contactNo.trim()) {
        user.contactNo = contactNo.trim();
        modified = true;
      }
      if (gPicture && (!user.logo || !user.logo.url)) {
        user.logo = { url: gPicture, public_id: 'google_avatar' };
        modified = true;
      }
      if (modified) await user.save();
    } else {
      user = await User.create({
        name: gName,
        email: gEmail,
        googleId: gSub,
        foodypayId: 'FP-' + Math.floor(100000 + Math.random() * 900000),
        businessName: businessName && businessName.trim() ? businessName.trim() : `${gName}'s Business`,
        contactNo: contactNo && contactNo.trim() ? contactNo.trim() : '+91 98000 00000',
        logo: {
          url: gPicture || '',
          public_id: 'google_avatar',
        },
        authProvider: 'google',
      });
    }

    const token = generateToken(user._id);

    res.json({
      success: true,
      data: {
        _id: user._id,
        foodypayId: user.foodypayId,
        name: user.name,
        email: user.email,
        businessName: user.businessName,
        contactNo: user.contactNo,
        logo: user.logo,
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Authenticate / Register via Firebase ID Token or Firebase User Object
 * @route   POST /api/auth/firebase
 * @access  Public
 */
export const firebaseAuth = async (req, res, next) => {
  try {
    const { firebaseToken, uid, email, name, picture, emailVerified, businessName, contactNo, providerId } = req.body;

    if (!email && !uid) {
      res.status(400);
      throw new Error('Firebase email or UID is required.');
    }

    const cleanEmail = (email || '').toLowerCase().trim();
    let user = null;

    if (uid) {
      user = await User.findOne({ firebaseUid: uid });
    }
    if (!user && cleanEmail) {
      user = await User.findOne({ email: cleanEmail });
    }

    if (user) {
      let modified = false;
      if (!user.firebaseUid && uid) {
        user.firebaseUid = uid;
        modified = true;
      }
      if (emailVerified !== undefined && user.isEmailVerified !== emailVerified) {
        user.isEmailVerified = Boolean(emailVerified);
        modified = true;
      }
      if (businessName && businessName.trim() && user.businessName !== businessName.trim()) {
        user.businessName = businessName.trim();
        modified = true;
      }
      if (contactNo && contactNo.trim() && user.contactNo !== contactNo.trim()) {
        user.contactNo = contactNo.trim();
        modified = true;
      }
      if (picture && (!user.logo || !user.logo.url)) {
        user.logo = { url: picture, public_id: 'firebase_avatar' };
        modified = true;
      }
      if (!user.foodypayId) {
        user.foodypayId = 'FP-' + Math.floor(100000 + Math.random() * 900000);
        modified = true;
      }
      if (modified) await user.save();
    } else {
      const foodypayId = 'FP-' + Math.floor(100000 + Math.random() * 900000);
      const defaultName = name || (cleanEmail ? cleanEmail.split('@')[0] : 'Merchant');
      const finalBusinessName = businessName && businessName.trim() ? businessName.trim() : `${defaultName}'s Business`;

      user = await User.create({
        name: defaultName,
        email: cleanEmail,
        firebaseUid: uid || null,
        isEmailVerified: Boolean(emailVerified),
        foodypayId,
        businessName: finalBusinessName,
        contactNo: contactNo && contactNo.trim() ? contactNo.trim() : '+91 98000 00000',
        logo: {
          url: picture || '',
          public_id: 'firebase_avatar',
        },
        authProvider: providerId === 'google.com' ? 'google' : 'firebase',
      });
    }

    const token = generateToken(user._id);

    res.json({
      success: true,
      data: {
        _id: user._id,
        foodypayId: user.foodypayId,
        name: user.name,
        email: user.email,
        businessName: user.businessName,
        contactNo: user.contactNo,
        logo: user.logo,
        firebaseUid: user.firebaseUid,
        isEmailVerified: user.isEmailVerified,
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get current user profile
 * @route   GET /api/auth/me
 * @access  Private
 */
export const getUserProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (user) {
      res.json({
        success: true,
        data: user,
      });
    } else {
      res.status(404);
      throw new Error('User not found');
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all registered users (Admin)
 * @route   GET /api/auth/users
 * @access  Public / Admin
 */
export const getAllUsers = async (req, res, next) => {
  try {
    const users = await User.find({}).select('-password').sort({ createdAt: -1 }).lean();

    const usersWithStats = await Promise.all(
      users.map(async (u) => {
        try {
          const [dishCount, orders, dishes] = await Promise.all([
            Dish.countDocuments({ user: u._id }),
            Order.find({ user: u._id }).select('total status createdAt items').lean(),
            Dish.find({ user: u._id }).select('name price category isVeg inStock desc').limit(20).lean(),
          ]);

          const totalOrders = orders.length;
          const totalSales = orders.reduce((sum, ord) => sum + (Number(ord.total) || 0), 0);

          return {
            ...u,
            totalSales,
            totalOrders,
            dishCount,
            dishes: dishes || [],
          };
        } catch (err) {
          return {
            ...u,
            totalSales: 0,
            totalOrders: 0,
            dishCount: 0,
            dishes: [],
          };
        }
      })
    );

    res.json({
      success: true,
      count: usersWithStats.length,
      data: usersWithStats,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete user account by ID (Admin)
 * @route   DELETE /api/auth/users/:id
 * @access  Public / Admin
 */
export const deleteUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      res.status(404);
      throw new Error('User account not found');
    }
    const deletedEmail = user.email;
    await User.findByIdAndDelete(req.params.id);
    res.json({
      success: true,
      message: `Account (${deletedEmail}) has been deleted permanently from database.`,
      email: deletedEmail,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete user account by Email (Admin)
 * @route   DELETE /api/auth/users/email/:email
 * @access  Public / Admin
 */
export const deleteUserByEmail = async (req, res, next) => {
  try {
    const targetEmail = req.params.email.toLowerCase().trim();
    const user = await User.findOne({ email: targetEmail });
    if (!user) {
      res.status(404);
      throw new Error(`User account with email ${targetEmail} not found`);
    }
    await User.findOneAndDelete({ email: targetEmail });
    res.json({
      success: true,
      message: `Account (${targetEmail}) has been deleted permanently from database.`,
      email: targetEmail,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get public merchant details for Customer Menu / Table QR ordering
 * @route   GET /api/auth/merchant/:identifier
 * @access  Public
 */
export const getPublicMerchantDetails = async (req, res, next) => {
  try {
    const { identifier } = req.params;
    let user = null;

    if (identifier && identifier !== 'undefined') {
      user = await User.findById(identifier).catch(() => null);
    }
    if (!user && identifier) {
      user = await User.findOne({ foodypayId: identifier.toUpperCase() });
    }
    if (!user && identifier) {
      const allUsers = await User.find({});
      user = allUsers.find((u) => {
        const slug = (u.businessName || u.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        return slug === identifier.toLowerCase();
      });
    }

    if (!user) {
      res.status(404);
      throw new Error('Merchant restaurant account not found');
    }

    res.json({
      success: true,
      data: {
        _id: user._id,
        foodypayId: user.foodypayId,
        businessName: user.businessName || user.name,
        name: user.name,
        contactNo: user.contactNo,
        logo: user.logo,
        gstPercent: 5,
        upiId: 'merchant@icici',
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Check if email exists in database before sending password reset link
 * @route   POST /api/auth/check-email
 * @access  Public
 */
export const checkEmailExists = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email || !email.trim()) {
      res.status(400);
      throw new Error('Email address is required.');
    }

    const cleanEmail = email.toLowerCase().trim();
    const escapedEmail = cleanEmail.replace(/[-[\]{}()*+?#\\^$|]/g, '\\$&');

    // Case-insensitive exact match with .lean() for maximum speed
    const user = await User.findOne({
      $or: [
        { email: cleanEmail },
        { email: { $regex: new RegExp(`^${escapedEmail}$`, 'i') } }
      ]
    }).lean();

    res.json({
      success: true,
      exists: Boolean(user),
      email: user ? user.email : cleanEmail,
      name: user ? user.name : null,
      businessName: user ? user.businessName : null,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Toggle user lock status (Lock / Unlock account requiring subscription)
 * @route   PUT /api/auth/users/:id/lock
 * @access  Public / Admin
 */
export const toggleUserLock = async (req, res, next) => {
  try {
    const { isLocked, lockReason } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      res.status(404);
      throw new Error('Merchant user account not found');
    }

    user.isLocked = isLocked !== undefined ? Boolean(isLocked) : !user.isLocked;
    if (lockReason) user.lockReason = lockReason;
    user.subscriptionStatus = user.isLocked ? 'Locked' : 'Active';

    await user.save();

    res.json({
      success: true,
      message: `User account ${user.email} is now ${user.isLocked ? 'LOCKED' : 'UNLOCKED'}.`,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update per-account subscription pricing & plan settings
 * @route   PUT /api/auth/users/:id/subscription
 * @access  Public / Admin
 */
export const updateUserSubscription = async (req, res, next) => {
  try {
    const { subscriptionPrice, subscriptionPlan, subscriptionStatus, subscriptionExpiry } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      res.status(404);
      throw new Error('Merchant user account not found');
    }

    if (subscriptionPrice !== undefined) user.subscriptionPrice = Number(subscriptionPrice) || 0;
    if (subscriptionPlan) user.subscriptionPlan = subscriptionPlan;
    if (subscriptionStatus) user.subscriptionStatus = subscriptionStatus;
    if (subscriptionExpiry) user.subscriptionExpiry = new Date(subscriptionExpiry);

    // If active status, unlock user automatically
    if (subscriptionStatus === 'Active') {
      user.isLocked = false;
    } else if (subscriptionStatus === 'Locked' || subscriptionStatus === 'Expired') {
      user.isLocked = true;
    }

    await user.save();

    res.json({
      success: true,
      message: `Subscription for ${user.email} updated successfully.`,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};



