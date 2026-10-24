import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import mongoose from 'mongoose';


import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

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
import printRoutes from './src/routes/printRoutes.js';
import crmRoutes from './src/routes/crmRoutes.js';
import staffRoutes from './src/routes/staffRoutes.js';
import { notFound, errorHandler } from './src/middlewares/errorMiddleware.js';

// Load environment variables
dotenv.config();

// Connect MongoDB as primary database
connectDB().catch(() => {});

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

// Real-Time API Telemetry & Request Logger Middleware
app.use((req, res, next) => {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'Unknown';

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const status = res.statusCode;
    const statusIcon = status >= 500 ? '❌' : status >= 400 ? '⚠️' : '✅';
    console.log(`[${timestamp}] ${statusIcon} ${req.method} ${req.originalUrl || req.url} | Status: ${status} | ${duration}ms | IP: ${clientIp}`);
  });

  next();
});

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

  // Determine stage / prod / dev
  // Checks APP_ENV, STAGE, NODE_ENV or optional req.query.env override
  const rawEnv = (
    req.query.env ||
    process.env.APP_ENV ||
    process.env.STAGE ||
    process.env.NODE_ENV ||
    'production'
  ).toString().toLowerCase();

  const isProd = rawEnv.includes('prod');
  const isStage = rawEnv.includes('stage') || rawEnv.includes('staging');
  const currentStage = isProd ? 'prod' : isStage ? 'stage' : 'development';
  const environmentName = isProd ? 'production' : isStage ? 'staging' : rawEnv;
  const branchName = process.env.BRANCH || process.env.GIT_BRANCH || process.env.RENDER_GIT_BRANCH || (isProd ? 'prod' : isStage ? 'stage' : 'main');

  res.status(200).json({
    status: 'online',
    success: true,
    service: 'FoodyPay API Server',
    version: '1.0.0',
    stage: currentStage,                 // 'prod' | 'stage' | 'development'
    environment: environmentName,        // 'production' | 'staging' | 'development'
    branch: branchName,                  // 'prod' | 'stage' | 'main'
    isProduction: isProd,
    isStaging: isStage,
    message: isProd ? 'FoodyPay API is running on PRODUCTION (prod)' : isStage ? 'FoodyPay API is running on STAGING (stage)' : `FoodyPay API is running on ${environmentName}`,
    timestamp: new Date().toISOString(),
    uptime: `${hours}h ${minutes}m ${seconds}s`,
    uptimeSeconds: Math.floor(uptimeSeconds),
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static CRM Merchant POS Dashboard at root (/) and /crm
const crmDir = path.join(__dirname, '..', 'crm');
app.use(express.static(crmDir));
app.use('/crm', express.static(crmDir));
app.get('/', (req, res) => {
  res.sendFile(path.join(crmDir, 'index.html'));
});
app.get(['/dashboard', '/pos'], (req, res) => {
  res.sendFile(path.join(crmDir, 'dashboard.html'));
});
// Waiter Terminal Routes: domain/waiter/:merchantId/:waiterId, etc.
app.get([
  '/waiter/:merchantId/:waiterId',
  '/waiter/:merchantId',
  '/waiter.html',
  '/waiter-app',
  '/waiter',
  '/menu/:uniqueId/waiter/:waiterId',
  '/menu/:uniqueId/:table/waiter/:waiterId',
  '/:uniqueId/waiter/:waiterId'
], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'customer-menu.html'));
});

// Customer / Client Table QR Routes: domain/client/:merchantId/:table or domain/order/:merchantId/:table
app.get([
  '/client/:merchantId/:table',
  '/client/:merchantId',
  '/client',
  '/order/:merchantId/:table',
  '/order/:merchantId',
  '/order.html',
  '/table-order.html',
  '/table-qr',
  '/order',
  '/menu/:uniqueId/:table',
  '/menu/:uniqueId'
], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'customer-menu.html'));
});

// Serve static public assets (customer menu, icons, styles)
app.use(express.static(path.join(__dirname, 'public')));

// Clean modular page routes (Frontend Portal, Waiter Login, Kitchen Display System)
app.get(['/pages', '/portal'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pages', 'index.html'));
});
app.get(['/login', '/waiter/login'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pages', 'waiter', 'login.html'));
});
app.get(['/kitchen', '/kds'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pages', 'kitchen', 'index.html'));
});

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
app.use('/api/print', printRoutes);
app.use('/api/crm', crmRoutes);
app.use('/api/staff', staffRoutes);

// Error Handling Middlewares
app.use(notFound);
app.use(errorHandler);

let PORT = process.env.PORT || 3000;

// Auto-configure EC2 Nginx SSL Reverse Proxy on Server Startup
const autoConfigureEc2Ssl = () => {
  if (process.platform !== 'linux') return;
  try {
    console.log('🔄 Checking EC2 Nginx SSL Configuration...');
    if (!fs.existsSync('/etc/ssl/certs/nginx-selfsigned.crt')) {
      execSync('sudo openssl req -x509 -nodes -days 3650 -newkey rsa:2048 -keyout /etc/ssl/private/nginx-selfsigned.key -out /etc/ssl/certs/nginx-selfsigned.crt -subj "/CN=3.108.59.216"', { stdio: 'ignore' });
    }
    const nginxConfig = `server {
    listen 80 default_server;
    listen [::]:80 default_server;
    listen 443 ssl default_server;
    listen [::]:443 ssl default_server;

    ssl_certificate /etc/ssl/certs/nginx-selfsigned.crt;
    ssl_certificate_key /etc/ssl/private/nginx-selfsigned.key;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}`;
    fs.writeFileSync('/etc/nginx/sites-available/default', nginxConfig);
    execSync('sudo nginx -t && sudo systemctl restart nginx', { stdio: 'ignore' });
    console.log('✅ EC2 Nginx SSL Reverse Proxy auto-configured for https://3.108.59.216 successfully!');
  } catch (err) {
    console.log('ℹ️ Nginx auto-config info:', err.message);
  }
};

const startServer = (port) => {
  const server = app.listen(port, () => {
    console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${port}`);
    autoConfigureEc2Ssl();
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
