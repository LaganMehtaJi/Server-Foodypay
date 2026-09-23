import Table from '../models/tableModel.js';

/**
 * @desc    Get all tables for authenticated user
 * @route   GET /api/tables
 * @access  Private
 */
export const getTables = async (req, res, next) => {
  try {
    const tables = await Table.find({ user: req.user._id }).sort({ createdAt: 1 });
    res.json({
      success: true,
      count: tables.length,
      data: tables,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create new table
 * @route   POST /api/tables
 * @access  Private
 */
export const createTable = async (req, res, next) => {
  try {
    const { name, capacity, section, purpose, theme, qrColor, cornerColor, logoUrl, url } = req.body;

    if (!name) {
      res.status(400);
      throw new Error('Please provide table name');
    }

    const table = await Table.create({
      user: req.user._id,
      name,
      capacity: Number(capacity) || 4,
      section: section || 'Indoor Dining',
      purpose: purpose || 'Contactless Self Ordering',
      theme: theme || 'acrylic',
      qrColor: qrColor || '#1E293B',
      cornerColor: cornerColor || '#FF5E14',
      logoUrl: logoUrl || '',
      url: url || '',
      status: 'available',
    });

    res.status(201).json({
      success: true,
      data: table,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update table details
 * @route   PUT /api/tables/:id
 * @access  Private
 */
export const updateTable = async (req, res, next) => {
  try {
    const { name, capacity, section, purpose, theme, qrColor, cornerColor, logoUrl, url, status } = req.body;
    const table = await Table.findOne({ _id: req.params.id, user: req.user._id });

    if (!table) {
      res.status(404);
      throw new Error('Table not found');
    }

    if (name !== undefined) table.name = name;
    if (capacity !== undefined) table.capacity = Number(capacity);
    if (section !== undefined) table.section = section;
    if (purpose !== undefined) table.purpose = purpose;
    if (theme !== undefined) table.theme = theme;
    if (qrColor !== undefined) table.qrColor = qrColor;
    if (cornerColor !== undefined) table.cornerColor = cornerColor;
    if (logoUrl !== undefined) table.logoUrl = logoUrl;
    if (url !== undefined) table.url = url;
    if (status !== undefined) table.status = status;

    await table.save();

    res.json({
      success: true,
      data: table,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update table status
 * @route   PUT /api/tables/:id/status
 * @access  Private
 */
export const updateTableStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const table = await Table.findOne({ _id: req.params.id, user: req.user._id });

    if (!table) {
      res.status(404);
      throw new Error('Table not found');
    }

    table.status = status || table.status;
    await table.save();

    res.json({
      success: true,
      data: table,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete table
 * @route   DELETE /api/tables/:id
 * @access  Private
 */
export const deleteTable = async (req, res, next) => {
  try {
    const table = await Table.findOneAndDelete({ _id: req.params.id, user: req.user._id });

    if (!table) {
      res.status(404);
      throw new Error('Table not found');
    }

    res.json({
      success: true,
      message: 'Table deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
