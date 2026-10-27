const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const { loadConfigFromSSM } = require('./config/ssm');
const { getDBPool } = require('./config/db');
const { logToCloudWatch } = require('./services/cloudWatchService');

const authRoutes = require('./routes/authRoutes');
const complaintRoutes = require('./routes/complaintRoutes');
const adminRoutes = require('./routes/adminRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request Logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.path.startsWith('/api') && req.path !== '/api/health') {
      console.log(`[HTTP] ${req.method} ${req.originalUrl} ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// Health check endpoint (for CloudWatch / EC2 status checks)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'HEALTHY',
    service: 'SmartServe AI Platform',
    timestamp: new Date().toISOString(),
    region: process.env.AWS_REGION || 'eu-north-1',
    uptime: process.uptime()
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/analytics', analyticsRoutes);

// Serve Static Frontend if built
const frontendDist = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendDist));
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    const indexPath = path.join(frontendDist, 'index.html');
    res.sendFile(indexPath, err => {
      if (err) {
        res.status(200).send(`
          <!DOCTYPE html>
          <html>
            <head><title>SmartServe AI Backend API</title><style>body{font-family:sans-serif;padding:40px;background:#f8fafc;color:#1e293b;}</style></head>
            <body>
              <h1>SmartServe AI API Server</h1>
              <p>Status: <strong>Running (Active)</strong></p>
              <p>Endpoints available under <code>/api/*</code>.</p>
              <p><a href="/api/health">Check /api/health</a></p>
            </body>
          </html>
        `);
      }
    });
  }
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Unhandled Error]:', err);
  res.status(500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

// Start Server
async function startServer() {
  try {
    console.log('==================================================');
    console.log('  SMARTSERVE AI - CAMPUS MANAGEMENT BACKEND      ');
    console.log('==================================================');

    // Pre-load configuration from SSM
    await loadConfigFromSSM();

    // Verify DB pool connectivity
    try {
      const pool = await getDBPool();
      const [rows] = await pool.query('SELECT 1 as connected');
      console.log('[Database] Database connection verified successfully.');
    } catch (dbErr) {
      console.warn(`[Database] Warning: RDS DB not ready or not directly reachable yet (${dbErr.message}). Waiting for RDS endpoint.`);
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[Server] SmartServe AI API server running on http://0.0.0.0:${PORT}`);
      logToCloudWatch(`SmartServe AI server started on port ${PORT}`, 'INFO');
    });
  } catch (err) {
    console.error('Fatal initialization error:', err);
    process.exit(1);
  }
}

startServer();

