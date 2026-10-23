import jwt from 'jsonwebtoken';
import User from '../models/userModel.js';

export const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Extract token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'foodypay_jwt_super_secret_key_2026_change_in_production'
      );

      // Get user from DB excluding password
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        res.status(401);
        throw new Error('User no longer exists or authorization failed');
      }

      return next();
    } catch  {
      res.status(401);
      return next(new Error('Not authorized, token failed or expired'));
    }
  }

  if (!token) {
    res.status(401);
    return next(new Error('Not authorized, no token provided'));
  }
};

/**
 * Optional Protect Middleware:
 * Decodes JWT token if present in Authorization header and sets req.user,
 * but allows the request to continue if no token is provided.
 */
export const optionalProtect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'foodypay_jwt_super_secret_key_2026_change_in_production'
      );
      req.user = await User.findById(decoded.id).select('-password');
    } catch  {
      // Continue without setting req.user
    }
  }

  next();
};

/**
 * Protect Waiter Middleware:
 * Verifies JWT token for Waiter operations (taking orders, editing running tables, printing KOT)
 * Attaches req.waiter = decoded.
 */
export const protectWaiter = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'foodypay_jwt_super_secret_key_2026_change_in_production'
      );

      if (!decoded || (!decoded.waiterId && !decoded.employeeId && !decoded.id)) {
        return res.status(401).json({
          success: false,
          message: 'Invalid Waiter token: missing waiter credentials',
        });
      }

      req.waiter = decoded;
      return next();
    } catch {
      return res.status(401).json({
        success: false,
        message: 'Waiter session expired or invalid token. Please log in again.',
      });
    }
  }

  return res.status(401).json({
    success: false,
    message: 'Authentication required: Waiter JWT token missing',
  });
};

/**
 * Optional Waiter Protect Middleware:
 * If Authorization Bearer is provided, verifies waiter JWT and attaches req.waiter.
 * If not provided, continues without error (for walk-in diners / QR customers).
 */
export const optionalWaiterProtect = async (req, res, next) => {
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'foodypay_jwt_super_secret_key_2026_change_in_production'
      );
      if (decoded && (decoded.waiterId || decoded.employeeId || decoded.id)) {
        req.waiter = decoded;
      }
    } catch {
      // Ignored for optional
    }
  }
  next();
};
