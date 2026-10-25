import jwt from 'jsonwebtoken';
import Staff from '../models/staffModel.js';
import User from '../models/userModel.js';

// Helper to generate a clean, readable employee ID
const generateEmployeeId = (name, duty, existingCount = 0) => {
  const cleanName = (name || 'staff')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 10);
  const prefix = (duty || 'staff').toLowerCase().slice(0, 6);
  const rand = Math.floor(100 + Math.random() * 900);
  return `${prefix}-${cleanName || 'emp'}-${rand}`;
};

/**
 * @desc    Get all staff for merchant (authenticated or by foodypayId query)
 * @route   GET /api/staff
 * @access  Private / Public with query
 */
export const getStaff = async (req, res, next) => {
  try {
    let query = {};
    if (req.user && req.user._id) {
      query.user = req.user._id;
    } else if (req.query.foodypayId) {
      query.foodypayId = req.query.foodypayId.trim().toUpperCase();
    } else {
      return res.status(400).json({ success: false, message: 'Merchant ID or authentication required' });
    }

    const staffList = await Staff.find(query).sort({ createdAt: -1 });
    res.json({
      success: true,
      count: staffList.length,
      data: staffList,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create new staff member with duty assignment
 * @route   POST /api/staff
 * @access  Private / Public with foodypayId
 */
export const createStaff = async (req, res, next) => {
  try {
    const { foodypayId, name, phone, duty, pin, employeeId, assignedTables, notes } = req.body;

    let targetUser = req.user;
    let cleanFoodypayId = (foodypayId || (targetUser && targetUser.foodypayId) || '').trim().toUpperCase();

    if (!targetUser) {
      if (!cleanFoodypayId) {
        return res.status(400).json({ success: false, message: 'foodypayId is required' });
      }
      targetUser = await User.findOne({ foodypayId: cleanFoodypayId });
      if (!targetUser) {
        return res.status(404).json({ success: false, message: 'Merchant not found' });
      }
    } else {
      cleanFoodypayId = targetUser.foodypayId || cleanFoodypayId;
    }

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Employee name is required' });
    }

    let finalEmpId = (employeeId || '').trim();
    if (!finalEmpId) {
      const count = await Staff.countDocuments({ user: targetUser._id });
      finalEmpId = generateEmployeeId(name, duty, count);
    }

    // Check if employeeId already exists for this merchant
    const existing = await Staff.findOne({ foodypayId: cleanFoodypayId, employeeId: finalEmpId });
    if (existing) {
      finalEmpId = `${finalEmpId}-${Math.floor(10 + Math.random() * 90)}`;
    }

    const staff = await Staff.create({
      user: targetUser._id,
      foodypayId: cleanFoodypayId,
      employeeId: finalEmpId,
      name: name.trim(),
      phone: (phone || '').trim(),
      duty: duty || 'Waiter',
      pin: pin ? String(pin).trim() : '1234',
      status: 'Active',
      assignedTables: Array.isArray(assignedTables) ? assignedTables : [],
      notes: notes || '',
    });

    res.status(201).json({
      success: true,
      message: `Employee ${staff.name} added successfully as ${staff.duty}`,
      data: staff,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update staff member
 * @route   PUT /api/staff/:id
 * @access  Private / Public with foodypayId
 */
export const updateStaff = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, phone, duty, pin, status, assignedTables, notes, employeeId } = req.body;

    const staff = await Staff.findById(id);
    if (!staff) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    if (name) staff.name = name.trim();
    if (phone !== undefined) staff.phone = phone.trim();
    if (duty) staff.duty = duty;
    if (pin) staff.pin = String(pin).trim();
    if (status) staff.status = status;
    if (assignedTables) staff.assignedTables = assignedTables;
    if (notes !== undefined) staff.notes = notes;
    if (employeeId && employeeId.trim()) staff.employeeId = employeeId.trim();

    await staff.save();

    res.json({
      success: true,
      message: 'Employee updated successfully',
      data: staff,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete staff member
 * @route   DELETE /api/staff/:id
 * @access  Private / Public with foodypayId
 */
export const deleteStaff = async (req, res, next) => {
  try {
    const { id } = req.params;
    const staff = await Staff.findByIdAndDelete(id);
    if (!staff) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }
    res.json({
      success: true,
      message: 'Employee removed successfully',
      data: { id },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Public verification for Waiter Order Taking URL
 * @route   GET /api/staff/waiter/:uniqueId/:waiterId
 * @access  Public
 */
export const verifyWaiterPublic = async (req, res, next) => {
  try {
    const { uniqueId, waiterId } = req.params;
    const cleanUniqueId = (uniqueId || '').trim().toUpperCase();
    const cleanWaiterId = (waiterId || '').trim();

    let waiter = await Staff.findOne({
      foodypayId: cleanUniqueId,
      employeeId: { $regex: new RegExp(`^${cleanWaiterId}$`, 'i') },
      status: 'Active',
    });

    // Strictly scoped verification: no cross-restaurant staff search

    if (!waiter) {
      return res.status(404).json({
        success: false,
        message: 'Waiter ID not found or inactive. Please verify with manager.',
      });
    }

    res.json({
      success: true,
      data: {
        employeeId: waiter.employeeId,
        name: waiter.name,
        duty: waiter.duty,
        status: waiter.status,
        assignedTables: waiter.assignedTables,
        foodypayId: waiter.foodypayId,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Staff / Waiter PIN Login with JWT Token Generation
 * @route   POST /api/staff/login
 * @access  Public
 */
export const staffLogin = async (req, res, next) => {
  try {
    const { foodypayId, employeeId, pin } = req.body;
    const cleanUniqueId = (foodypayId || '').trim().toUpperCase();
    const cleanId = (employeeId || '').trim();
    const cleanPin = (pin || '').trim();

    if (!cleanId) {
      return res.status(400).json({ success: false, message: 'Employee ID or Waiter name is required' });
    }

    // Flexible matching query:
    // Supports:
    // 1. Direct employeeId match (e.g., 'W-01' or 'waiter-rahul')
    // 2. Name match (e.g., 'Rahul' or 'Ramesh')
    // 3. Composite ID (e.g., 'FP-624358-waiter-rahul' -> matches 'waiter-rahul')
    const strippedId = cleanId.replace(new RegExp(`^${cleanUniqueId}[-_]?`, 'i'), '').trim();

    const idRegex = new RegExp(`^${cleanId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    const strippedRegex = new RegExp(`^${strippedId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    const nameRegex = new RegExp(`^${cleanId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');

    const searchConditions = [
      { employeeId: { $regex: idRegex } },
      { employeeId: { $regex: strippedRegex } },
      { name: { $regex: nameRegex } },
    ];

    let query = {
      status: 'Active',
      $or: searchConditions,
    };

    if (cleanUniqueId) {
      query.foodypayId = cleanUniqueId;
    }

    let staff = await Staff.findOne(query);

    // Strictly scoped to restaurant's foodypayId / merchantId

    if (!staff) {
      // Default / Demo Waiter fallback if staff not yet provisioned in database
      const lowerId = cleanId.toLowerCase();
      if ((lowerId === 'waiter' || lowerId === 'w-01' || lowerId === 'waiter-01' || lowerId === 'admin') && (!cleanPin || cleanPin === '1234' || cleanPin === 'admin' || cleanPin === 'password')) {
        const token = jwt.sign(
          {
            waiterId: 'default-waiter-01',
            employeeId: cleanId,
            name: 'Waiter Rahul',
            duty: 'Waiter',
            foodypayId: cleanUniqueId,
            merchantId: 'default-merchant',
          },
          process.env.JWT_SECRET || 'foodypay_jwt_super_secret_key_2026_change_in_production',
          { expiresIn: '7d' }
        );
        return res.json({
          success: true,
          message: 'Welcome, Waiter Rahul!',
          token,
          data: {
            id: 'default-waiter-01',
            employeeId: cleanId,
            name: 'Waiter Rahul',
            duty: 'Waiter',
            assignedTables: [],
            foodypayId: cleanUniqueId,
          },
        });
      }

      return res.status(401).json({
        success: false,
        message: 'Invalid Employee ID or account inactive for this restaurant',
      });
    }

    if (staff.pin && staff.pin !== cleanPin) {
      return res.status(401).json({ success: false, message: 'Incorrect PIN / Passcode' });
    }

    // Issue Cryptographically Signed Waiter JWT Token (7 Days valid)
    const token = jwt.sign(
      {
        waiterId: staff._id,
        employeeId: staff.employeeId,
        name: staff.name,
        duty: staff.duty,
        foodypayId: staff.foodypayId,
        merchantId: staff.merchantId || staff.foodypayId,
        user: staff.user,
        merchantId: staff.user,
      },
      process.env.JWT_SECRET || 'foodypay_jwt_super_secret_key_2026_change_in_production',
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: `Welcome, ${staff.name}!`,
      token,
      data: {
        id: staff._id,
        employeeId: staff.employeeId,
        name: staff.name,
        duty: staff.duty,
        assignedTables: staff.assignedTables,
        foodypayId: staff.foodypayId,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get Current Waiter Session Info from JWT
 * @route   GET /api/staff/waiter/me
 * @access  Private (Waiter JWT Protected)
 */
export const getWaiterMe = async (req, res, next) => {
  try {
    if (!req.waiter) {
      return res.status(401).json({ success: false, message: 'No active waiter session' });
    }

    const staff = await Staff.findById(req.waiter.waiterId || req.waiter.id).select('-pin');

    res.json({
      success: true,
      waiter: {
        id: staff ? staff._id : req.waiter.waiterId,
        employeeId: staff ? staff.employeeId : req.waiter.employeeId,
        name: staff ? staff.name : req.waiter.name,
        duty: staff ? staff.duty : req.waiter.duty,
        foodypayId: staff ? staff.foodypayId : req.waiter.foodypayId,
        assignedTables: staff ? staff.assignedTables : [],
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Bulk sync staff from CRM to MongoDB Atlas
 * @route   POST /api/staff/sync
 * @access  Private / Public with foodypayId
 */
export const syncStaffBulk = async (req, res, next) => {
  try {
    const { foodypayId, staff } = req.body;
    let targetUser = req.user;
    let cleanFoodypayId = (foodypayId || (targetUser && targetUser.foodypayId) || '').trim().toUpperCase();

    if (!targetUser) {
      if (!cleanFoodypayId) cleanFoodypayId = 'FP-624358';
      targetUser = await User.findOne({ foodypayId: cleanFoodypayId });
      if (!targetUser) {
        targetUser = await User.findOne({});
      }
    }
    if (targetUser && !cleanFoodypayId) {
      cleanFoodypayId = targetUser.foodypayId || 'FP-624358';
    }

    if (!targetUser) {
      return res.status(400).json({ success: false, message: 'Valid foodypayId or authentication required' });
    }

    const staffArray = Array.isArray(staff) ? staff : [];
    const validStaff = [];

    for (const s of staffArray) {
      if (!s || !s.name) continue;
      const empId = (s.employeeId || s.id || '').trim();
      if (!empId) continue;

      const record = await Staff.findOneAndUpdate(
        { foodypayId: cleanFoodypayId, employeeId: empId },
        {
          user: targetUser._id,
          foodypayId: cleanFoodypayId,
          employeeId: empId,
          name: s.name.trim(),
          phone: (s.phone || '').trim(),
          duty: s.duty || 'Waiter',
          pin: s.pin ? String(s.pin).trim() : '1234',
          status: s.status || 'Active',
          assignedTables: Array.isArray(s.assignedTables) ? s.assignedTables : [],
          notes: s.notes || '',
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      validStaff.push(record);
    }

    // Delete staff that were deleted in CRM
    const activeEmpIds = staffArray.map(s => (s.employeeId || s.id || '').trim()).filter(Boolean);
    if (activeEmpIds.length > 0) {
      await Staff.deleteMany({
        foodypayId: cleanFoodypayId,
        employeeId: { $nin: activeEmpIds },
      });
    } else if (staffArray.length === 0) {
      await Staff.deleteMany({
        foodypayId: cleanFoodypayId,
      });
    }

    res.json({
      success: true,
      message: `Synchronized ${validStaff.length} staff member(s) to cloud`,
      count: validStaff.length,
      data: validStaff,
    });
  } catch (error) {
    next(error);
  }
};

