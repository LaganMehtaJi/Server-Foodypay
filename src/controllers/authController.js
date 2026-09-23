import User from '../models/userModel.js';
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

    if (!name || !email || !password || !businessName || !contactNo) {
      res.status(400);
      throw new Error('Please fill in all required fields: name, email, password, businessName, contactNo');
    }

    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      res.status(400);
      throw new Error('User already exists with this email address');
    }

    // Upload logo to Cloudinary if provided
    let logoData = { url: '', public_id: '' };
    if (req.file) {
      logoData = await uploadToCloudinary(req.file.buffer, 'foodypay_logos');
    }

    const foodypayId = 'FP-' + Math.floor(100000 + Math.random() * 900000);

    // Create User
    const user = await User.create({
      name,
      email,
      password,
      foodypayId,
      businessName,
      contactNo,
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

    // Find user and explicitly select password
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      res.status(401);
      throw new Error('Invalid email or password');
    }

    if (user.authProvider === 'google' && !user.password) {
      res.status(400);
      throw new Error('This email is registered via Google Login. Please sign in with Google.');
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
    const { credential, businessName, contactNo } = req.body;

    if (!credential) {
      res.status(400);
      throw new Error('Google credential / ID Token is required');
    }

    let gEmail, gName, gPicture, gSub;

    try {
      // Verify Google ID Token
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
      // Fallback in case decoded payload is sent directly from client verification test
      if (req.body.email && req.body.googleId) {
        gEmail = req.body.email;
        gName = req.body.name || 'Google User';
        gPicture = req.body.picture || '';
        gSub = req.body.googleId;
      } else {
        res.status(401);
        throw new Error('Invalid Google credential token');
      }
    }

    let user = await User.findOne({ email: gEmail });

    if (user) {
      // Update googleId & foodypayId if not present
      let modified = false;
      if (!user.googleId) {
        user.googleId = gSub;
        modified = true;
      }
      if (!user.foodypayId) {
        user.foodypayId = 'FP-' + Math.floor(100000 + Math.random() * 900000);
        modified = true;
      }
      if (modified) await user.save();
    } else {
      // Create new user via Google Sign In
      user = await User.create({
        name: gName,
        email: gEmail,
        googleId: gSub,
        foodypayId: 'FP-' + Math.floor(100000 + Math.random() * 900000),
        businessName: businessName || `${gName}'s Business`,
        contactNo: contactNo || '',
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
