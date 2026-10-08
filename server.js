import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import mongoose from 'mongoose';

//Conection with MongoDB
import connectDB from './src/config/db.js';


import authRoutes from './src/routes/authRoutes.js';
import dashboardRoutes from './src/routes/dashboardRoutes.js';
import orderRoutes from './src/routes/orderRoutes.js';
import dishRoutes from './src/routes/dishRoutes.js';
import customerRoutes from './src/routes/customerRoutes.js';
import couponRoutes from './src/routes/couponRoutes.js';
import { getPublicCustomerCoupons } from './src/controllers/couponController.js';
import tableRoutes from './src/routes/tableRoutes.js';
import settingRoutes from './src/routes/settingRoutes.js';
import reviewRoutes from './src/routes/reviewRoutes.js';
import paymentRoutes from './src/routes/paymentRoutes.js';
import notificationRoutes from './src/routes/notificationRoutes.js';
import deliveryZoneRoutes from './src/routes/deliveryZoneRoutes.js';
import storeRoutes from './src/routes/storeRoutes.js';
import customerLocationRoutes from './src/routes/customerLocationRoutes.js';
import { notFound, errorHandler } from './src/middlewares/errorMiddleware.js';

// Load environment variables
dotenv.config();

// Connect to MongoDB Database
connectDB();

const app = express();

// Middlewares & Universal Permissive CORS Policy
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization', '*'],
  optionsSuccessStatus: 200,
}));

// Universal Cross-Origin & Referrer Policy Headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, *');
  res.header('Referrer-Policy', 'no-referrer-when-downgrade');
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Server Telemetry & Status API Endpoints (/status, /api/status, /api/health)
const getSystemStatus = (req, res) => {
  const dbStateMap = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  const uptimeSeconds = process.uptime();
  const hours = Math.floor(uptimeSeconds / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  const seconds = Math.floor(uptimeSeconds % 60);

  const memUsage = process.memoryUsage();

  res.status(200).json({
    status: 'online',
    success: true,
    service: 'FoodyPay API Server',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: `${hours}h ${minutes}m ${seconds}s`,
    uptimeSeconds: Math.floor(uptimeSeconds),
    environment: process.env.NODE_ENV || 'development',
    database: {
      status: dbStateMap[mongoose.connection.readyState] || 'unknown',
      host: mongoose.connection.host || '127.0.0.1',
      name: mongoose.connection.name || 'foodypay',
    },
    memory: {
      rssMB: Math.round((memUsage.rss / 1024 / 1024) * 100) / 100,
      heapTotalMB: Math.round((memUsage.heapTotal / 1024 / 1024) * 100) / 100,
      heapUsedMB: Math.round((memUsage.heapUsed / 1024 / 1024) * 100) / 100,
    },
    endpoints: {
      status: '/status',
      auth: '/api/auth',
      dashboard: '/api/dashboard',
      orders: '/api/orders',
      dishes: '/api/dishes',
      customers: '/api/customers',
      coupons: '/api/coupons',
      tables: '/api/tables',
      settings: '/api/settings',
    },
  });
};

app.get('/status', getSystemStatus);
app.get('/api/status', getSystemStatus);
app.get('/api/health', getSystemStatus);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/dishes', dishRoutes);
app.use('/api/customers', customerRoutes);
app.get('/api/coupons/public', getPublicCustomerCoupons);
app.use('/api/coupons', couponRoutes);
app.use('/api/tables', tableRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/delivery', deliveryZoneRoutes);
app.use('/api/stores', storeRoutes);
app.use('/api/customer/location', customerLocationRoutes);
app.use('/api/customer', customerLocationRoutes);

// Error Handling Middlewares
app.use(notFound);
app.use(errorHandler);

let PORT = process.env.PORT || 5001;

const startServer = (port) => {
  const server = app.listen(port, () => {
    console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${port}`);
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.warn(`Port ${port} is in use. Trying port ${Number(port) + 1}...`);
      console.log('Express server initialized.');
      startServer(Number(port) + 1);
    } else {
      console.error('Server error:', error);
    }
  });
};

startServer(PORT);
