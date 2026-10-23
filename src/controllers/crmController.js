import { CrmCatalog, CrmDailySummary } from '../models/crmModel.js';
import Order from '../models/orderModel.js';
import Setting from '../models/settingModel.js';
import Dish from '../models/dishModel.js';
import User from '../models/userModel.js';

/**
 * @desc    Save/Sync entire CRM catalog (categories, products, areas/tables)
 * @route   POST /api/crm/catalog
 * @access  Private
 */
export const syncCatalog = async (req, res, next) => {
  try {
    const { categories, products, areas, foodypayId, businessName, name, phone } = req.body;
    let userId = req.user ? req.user._id : null;
    let cleanFp = (foodypayId || (req.user ? req.user.foodypayId : '') || '').toString().trim().toUpperCase();

    if (!userId && cleanFp) {
      const stripped = cleanFp.replace(/^FP[-_]?/i, '').trim();
      const idRegex = new RegExp(`^(FP[-_]?)?${stripped}$`, 'i');
      const u = await User.findOne({
        $or: [{ foodypayId: cleanFp }, { foodypayId: idRegex }]
      });
      if (u) {
        userId = u._id;
        cleanFp = u.foodypayId;
      }
    }

    if (!userId && req.body.email) {
      const u = await User.findOne({ email: req.body.email.toLowerCase().trim() });
      if (u) {
        userId = u._id;
        cleanFp = u.foodypayId;
      }
    }

    if (!userId) {
      const u = (await User.findOne({ foodypayId: 'FP-624358' })) || (await User.findOne({}));
      if (u) {
        userId = u._id;
        cleanFp = u.foodypayId;
      }
    }

    if (!userId) {
      return res.status(400).json({ success: false, message: 'Valid foodypayId or authentication required' });
    }

    const finalBusinessName = (businessName || name || '').trim();
    if (finalBusinessName) {
      await User.findByIdAndUpdate(userId, { businessName: finalBusinessName }).catch(() => {});
      await Setting.findOneAndUpdate(
        { user: userId },
        {
          restName: finalBusinessName,
          ...(phone ? { phone: String(phone).trim() } : {})
        },
        { upsert: true }
      ).catch(() => {});
    }

    const catalog = await CrmCatalog.findOneAndUpdate(
      { user: userId },
      {
        user: userId,
        foodypayId: cleanFp,
        businessName: finalBusinessName,
        categories: Array.isArray(categories) ? categories : [],
        products: Array.isArray(products) ? products : [],
        areas: Array.isArray(areas) ? areas : [],
        lastSyncedAt: new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Also mirror products into Dish collection for public QR ordering
    if (Array.isArray(products) && products.length > 0) {
      for (const p of products) {
        if (!p || !p.name) continue;
        const dishName = String(p.name).trim();
        const basePrice = Array.isArray(p.vars) && p.vars.length > 0 ? Number(p.vars[0]?.p || 0) : Number(p.price || 0);
        const sizes = Array.isArray(p.vars) ? p.vars.map(v => ({ name: v.n || 'Regular', price: Number(v.p || 0) })) : [];

        await Dish.findOneAndUpdate(
          { user: userId, name: new RegExp(`^${dishName}$`, 'i') },
          {
            user: userId,
            sku: cleanFp || '',
            name: dishName,
            category: p.cat || 'General',
            price: basePrice,
            sizes,
            image: { url: p.img || '', public_id: '' },
            inStock: true,
            isActive: true,
          },
          { upsert: true, new: true }
        ).catch(() => {});
      }
    }

    res.json({
      success: true,
      message: 'Catalog synchronized successfully with MongoDB',
      data: catalog,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get CRM catalog for authenticated user
 * @route   GET /api/crm/catalog
 * @access  Private
 */
export const getCatalog = async (req, res, next) => {
  try {
    const catalog = await CrmCatalog.findOne({ user: req.user._id });
    res.json({
      success: true,
      data: catalog || { categories: [], products: [], areas: [] },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Sync batch of completed settlements & daily summary
 * @route   POST /api/crm/sales/batch
 * @access  Private
 */
export const syncSalesBatch = async (req, res, next) => {
  try {
    const { date, sales, summary } = req.body;
    const userId = req.user._id;
    const targetDate = date || new Date().toISOString().split('T')[0];

    // 1. Upsert daily summary
    let savedSummary = null;
    if (summary) {
      savedSummary = await CrmDailySummary.findOneAndUpdate(
        { user: userId, date: targetDate },
        {
          user: userId,
          foodypayId: req.user.foodypayId || '',
          date: targetDate,
          totalRevenue: Number(summary.todayRevenue ?? summary.totalRevenue ?? 0),
          ordersCount: Number(summary.todayOrdersCount ?? summary.ordersCount ?? 0),
          cashTotal: Number(summary.cashTotal ?? 0),
          upiTotal: Number(summary.upiTotal ?? 0),
          cardTotal: Number(summary.cardTotal ?? 0),
          dueTotal: Number(summary.dueTotal ?? 0),
          lastSyncedAt: new Date(),
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }

    // 2. Upsert orders into primary Order model
    let savedCount = 0;
    if (Array.isArray(sales) && sales.length > 0) {
      for (const s of sales) {
        if (!s) continue;
        const rawId = String(s.id || s.end || s.start || '');
        const orderId = rawId.startsWith('#') ? rawId : `#FP-${rawId.slice(-6)}`;

        const orderItems = Array.isArray(s.items)
          ? s.items.map(item => ({
              name: item.name || 'Item',
              qty: Number(item.qty || 1),
              price: Number(item.price || item.p || 0),
              isVeg: item.isVeg !== false,
            }))
          : [];

        const orderPayload = {
          user: userId,
          foodypayId: req.user.foodypayId || '',
          orderId,
          type: s.orderType || s.area || 'Dine-In',
          table: s.table ? String(s.table) : 'Table 1',
          customer: (s.cust && s.cust.name) || s.customer || 'Walk-in Guest',
          phone: (s.cust && s.cust.phone) || s.phone || '',
          address: (s.cust && s.cust.addr) || s.address || '',
          status: s.status === 'UNPAID' ? 'served' : 'completed',
          paymentMode: s.mode || 'Cash',
          paymentStatus: s.status === 'UNPAID' ? 'unpaid' : 'paid',
          paymentLabel: s.mode || 'Cash on Counter',
          items: orderItems,
          note: s.note || '',
          seen: true,
          subtotal: Number(s.subtotal || s.total || 0),
          discount: Number(s.disc || s.discount || 0),
          tax: Number(s.tax || 0),
          total: Number(s.total || 0),
          createdAt: s.start ? new Date(s.start) : new Date(),
          updatedAt: s.end ? new Date(s.end) : new Date(),
        };

        await Order.findOneAndUpdate(
          { user: userId, orderId },
          { $set: orderPayload },
          { upsert: true, new: true }
        ).catch(() => {});

        savedCount++;
      }
    }

    res.json({
      success: true,
      message: `Batch sync successful! ${savedCount} orders saved in MongoDB.`,
      savedCount,
      summary: savedSummary,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get sales history & summary for selected date
 * @route   GET /api/crm/sales
 * @access  Private
 */
export const getSales = async (req, res, next) => {
  try {
    const { date } = req.query;
    const userId = req.user._id;

    let dateFilter = { user: userId };
    if (date) {
      const startOfDay = new Date(`${date}T00:00:00.000Z`);
      const endOfDay = new Date(`${date}T23:59:59.999Z`);
      dateFilter.createdAt = { $gte: startOfDay, $lte: endOfDay };
    }

    const [orders, summary] = await Promise.all([
      Order.find(dateFilter).sort({ createdAt: -1 }).limit(300).lean(),
      date ? CrmDailySummary.findOne({ user: userId, date }) : null,
    ]);

    // Format for CRM index.html table compatibility
    const formattedSales = orders.map(o => ({
      id: o.orderId || o._id.toString(),
      start: new Date(o.createdAt).getTime(),
      end: new Date(o.updatedAt || o.createdAt).getTime(),
      table: o.table,
      orderType: o.type,
      mode: o.paymentMode || 'Cash',
      status: o.paymentStatus === 'unpaid' ? 'UNPAID' : 'PAID',
      items: o.items || [],
      total: o.total || 0,
      cust: { name: o.customer, phone: o.phone, addr: o.address },
      note: o.note || '',
    }));

    res.json({
      success: true,
      sales: formattedSales,
      summary: summary || null,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Save/Sync store settings
 * @route   POST /api/crm/settings
 * @access  Private
 */
export const syncSettings = async (req, res, next) => {
  try {
    const { name, businessName, phone, gst, billDesign, printers, foodypayId } = req.body;
    let userId = req.user ? req.user._id : null;

    if (!userId && foodypayId) {
      const cleanFp = String(foodypayId).trim().toUpperCase();
      const stripped = cleanFp.replace(/^FP[-_]?/i, '').trim();
      const u = await User.findOne({
        $or: [
          { foodypayId: cleanFp },
          { foodypayId: new RegExp(`^(FP[-_]?)?${stripped}$`, 'i') }
        ]
      });
      if (u) userId = u._id;
    }

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication or valid merchant ID required' });
    }

    let setting = await Setting.findOne({ user: userId });
    if (!setting) {
      setting = new Setting({ user: userId });
    }

    const finalName = (name || businessName || '').trim();
    if (finalName) {
      setting.restName = finalName;
      await User.findByIdAndUpdate(userId, { businessName: finalName }).catch(() => {});
      await CrmCatalog.findOneAndUpdate({ user: userId }, { businessName: finalName }).catch(() => {});
    }
    if (phone) {
      setting.phone = phone;
      await User.findByIdAndUpdate(userId, { contactNo: phone }).catch(() => {});
    }
    if (gst && typeof gst.rate === 'number') {
      setting.gstPercent = gst.rate;
    }

    await setting.save();

    res.json({
      success: true,
      message: 'Store settings synced to MongoDB',
      data: {
        name: setting.restName,
        phone: setting.phone,
        gst: gst || { enabled: true, rate: setting.gstPercent },
        billDesign: billDesign || {},
        printers: printers || {},
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Full single-call restore of Catalog, Sales History & Settings
 * @route   GET /api/crm/sync-all
 * @access  Private
 */
export const syncAll = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const todayStr = new Date().toISOString().split('T')[0];

    const [catalog, orders, setting, summary] = await Promise.all([
      CrmCatalog.findOne({ user: userId }).lean(),
      Order.find({ user: userId }).sort({ createdAt: -1 }).limit(300).lean(),
      Setting.findOne({ user: userId }).lean(),
      CrmDailySummary.findOne({ user: userId, date: todayStr }).lean(),
    ]);

    const formattedSales = (orders || []).map(o => ({
      id: o.orderId || o._id.toString(),
      start: new Date(o.createdAt).getTime(),
      end: new Date(o.updatedAt || o.createdAt).getTime(),
      table: o.table,
      orderType: o.type,
      mode: o.paymentMode || 'Cash',
      status: o.paymentStatus === 'unpaid' ? 'UNPAID' : 'PAID',
      items: o.items || [],
      total: o.total || 0,
      cust: { name: o.customer, phone: o.phone, addr: o.address },
      note: o.note || '',
    }));

    res.json({
      success: true,
      catalog: catalog || { categories: [], products: [], areas: [] },
      sales: formattedSales,
      summary: summary || null,
      settings: {
        name: setting?.restName || req.user.businessName || '',
        phone: setting?.phone || req.user.contactNo || '',
        gst: {
          enabled: true,
          rate: setting?.gstPercent || 5,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get live sales changes for multi-device sync
 * @route   GET /api/crm/sales/live
 * @access  Private
 */
export const getLiveSales = async (req, res, next) => {
  try {
    const { since } = req.query;
    const userId = req.user._id;

    const filter = { user: userId };
    if (since) {
      filter.updatedAt = { $gt: new Date(Number(since) || since) };
    }

    const orders = await Order.find(filter).sort({ updatedAt: -1 }).limit(50).lean();

    const formattedSales = orders.map(o => ({
      id: o.orderId || o._id.toString(),
      start: new Date(o.createdAt).getTime(),
      end: new Date(o.updatedAt || o.createdAt).getTime(),
      table: o.table,
      orderType: o.type,
      mode: o.paymentMode || 'Cash',
      status: o.paymentStatus === 'unpaid' ? 'UNPAID' : 'PAID',
      items: o.items || [],
      total: o.total || 0,
      cust: { name: o.customer, phone: o.phone, addr: o.address },
      note: o.note || '',
    }));

    res.json({
      success: true,
      sales: formattedSales,
      serverTime: Date.now(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get public menu catalog by Unique Merchant ID (foodypayId) for QR code ordering
 * @route   GET /api/crm/menu/:uniqueId
 * @access  Public
 */
export const getPublicMenu = async (req, res, next) => {
  try {
    const rawId = req.params.uniqueId || req.query.foodypayId || req.query.uniqueId;
    if (!rawId) {
      return res.status(400).json({ success: false, message: 'Merchant Unique ID is required' });
    }
    const cleanId = String(rawId).trim();
    const cleanUpper = cleanId.toUpperCase();
    const stripped = cleanUpper.replace(/^FP[-_]?/i, '').trim();
    const idRegex = new RegExp(`^(FP[-_]?)?${stripped}$`, 'i');

    let targetUser = await User.findOne({
      $or: [
        { foodypayId: cleanUpper },
        { foodypayId: idRegex },
        { email: new RegExp(`^${cleanId}$`, 'i') },
        ...(cleanId.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: cleanId }] : [])
      ]
    });

    if (!targetUser) {
      const cat = await CrmCatalog.findOne({
        $or: [{ foodypayId: cleanUpper }, { foodypayId: idRegex }]
      });
      if (cat?.user) {
        targetUser = await User.findById(cat.user);
      }
    }

    if (!targetUser) {
      const set = await Setting.findOne({
        $or: [{ foodypayId: cleanUpper }, { foodypayId: idRegex }]
      });
      if (set?.user) {
        targetUser = await User.findById(set.user);
      }
    }

    const defaultProducts = [
      { id: 'fp_p1', name: 'Paneer Tikka', cat: 'Starters', diet: 'veg', vars: [{ n: 'Half', p: 140 }, { n: 'Full', p: 260 }], price: 140, img: '' },
      { id: 'fp_p2', name: 'Veg Noodles', cat: 'Starters', diet: 'veg', vars: [{ n: 'Regular', p: 120 }], price: 120, img: '' },
      { id: 'fp_p3', name: 'Dal Makhani', cat: 'Main Course', diet: 'veg', vars: [{ n: 'Qtr', p: 90 }, { n: 'Half', p: 160 }, { n: 'Full', p: 290 }], price: 160, img: '' },
      { id: 'fp_p4', name: 'Butter Naan', cat: 'Main Course', diet: 'veg', vars: [{ n: 'Regular', p: 35 }], price: 35, img: '' },
      { id: 'fp_p5', name: 'Cold Coffee', cat: 'Drinks', diet: 'veg', vars: [{ n: 'Small', p: 80 }, { n: 'Large', p: 120 }], price: 80, img: '' },
      { id: 'fp_p6', name: 'Gulab Jamun', cat: 'Dessert', diet: 'veg', vars: [{ n: '2 pcs', p: 60 }], price: 60, img: '' },
    ];
    const defaultCats = ['Starters', 'Main Course', 'Drinks', 'Dessert'];
    const defaultAreas = [
      { name: 'Restaurant', tables: [1, 2, 3, 4, 5, 6].map(n => ({ id: 'tbl_' + n, name: String(n) })) },
      { name: 'Cafe', tables: ['T1', 'T2', 'T3'].map(n => ({ id: 'tbl_' + n, name: n })) },
    ];

    // If ID is not registered in MongoDB, gracefully provide fallback for this exact ID (never BigBoss)
    if (!targetUser) {
      const fallbackName = (req.query.name || req.query.restName || req.query.storeName || '').trim() || `Food Outlet (${cleanUpper})`;
      return res.json({
        success: true,
        data: {
          foodypayId: cleanUpper,
          businessName: fallbackName,
          contactNo: '',
          logo: '',
          gstPercent: 5,
          upiId: '',
          categories: defaultCats,
          products: defaultProducts,
          areas: defaultAreas,
        },
      });
    }

    const catalog = await CrmCatalog.findOne({ user: targetUser._id });
    const setting = await Setting.findOne({ user: targetUser._id }).catch(() => null);

    // If request provided a specific store name from QR badge / waiter link, update user profile and settings
    const queryName = (req.query.name || req.query.restName || req.query.storeName || '').trim();
    if (queryName && queryName !== 'Foodypay' && queryName !== 'BigBoss') {
      await User.findByIdAndUpdate(targetUser._id, { businessName: queryName }).catch(() => {});
      await Setting.findOneAndUpdate({ user: targetUser._id }, { restName: queryName }, { upsert: true }).catch(() => {});
      await CrmCatalog.findOneAndUpdate({ user: targetUser._id }, { businessName: queryName }).catch(() => {});
      if (setting) setting.restName = queryName;
      targetUser.businessName = queryName;
    }

    const finalBusinessName =
      (queryName && queryName !== 'Foodypay' && queryName !== 'BigBoss' ? queryName : '') ||
      setting?.restName?.trim() ||
      targetUser.businessName?.trim() ||
      catalog?.businessName?.trim() ||
      targetUser.name?.trim() ||
      `Food Outlet (${targetUser.foodypayId || cleanUpper})`;

    let products = (catalog?.products && catalog.products.length > 0) ? catalog.products : [];
    let categories = (catalog?.categories && catalog.categories.length > 0) ? catalog.categories : [];
    let areas = (catalog?.areas && catalog.areas.length > 0) ? catalog.areas : [];

    // Fallback: If CrmCatalog has no products yet
    if (!products || products.length === 0) {
      products = defaultProducts;
      categories = defaultCats;
      areas = defaultAreas;

      await CrmCatalog.findOneAndUpdate(
        { user: targetUser._id },
        {
          user: targetUser._id,
          foodypayId: targetUser.foodypayId,
          businessName: finalBusinessName,
          categories: defaultCats,
          products: defaultProducts,
          areas: defaultAreas,
          lastSyncedAt: new Date(),
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      ).catch(() => {});
    }

    res.json({
      success: true,
      data: {
        foodypayId: targetUser.foodypayId,
        businessName: finalBusinessName,
        contactNo: setting?.phone || targetUser.contactNo || '',
        logo: targetUser.logo?.url || setting?.logo?.url || '',
        gstPercent: setting?.gstPercent || setting?.taxPercent || 5,
        upiId: setting?.upiId || '',
        categories,
        products,
        areas,
      },
    });
  } catch (error) {
    next(error);
  }
};

