require('express-async-errors');
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const { v4: uuidv4 } = require('uuid');
const os = require('os');

const leadRoutes = require('./routes/leads');
const contractorRoutes = require('./routes/contractors');
const stripeRoutes = require('./routes/stripe');
const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const ocrRoutes = require('./routes/ocr');
const aiBudgetForecastRoutes = require('./routes/aiBudgetForecast');
const aiExpenseValidationRoutes = require('./routes/aiExpenseValidation');
const aiPredictiveAnalyticsRoutes = require('./routes/aiPredictiveAnalytics');
const materialsRoutes = require('./routes/materials');
const skuRoutes = require('./routes/sku');
const yelpRoutes = require('./routes/yelp');
const blsRoutes = require('./routes/bls');
const costBenchmarksRoutes = require('./routes/cost-benchmarks');
const marketplaceLeadsRoutes = require('./routes/marketplace-leads');
const leadScoringService = require('./services/leadScoring');
const marketplaceSyncService = require('./services/marketplaceSync');
const projectLeadsRoutes = require('./routes/project-leads');
const bidInvitationsRoutes = require('./routes/bid-invitations');
const sharedLeadsRoutes = require('./routes/shared-leads');
const unifiedLeadsRoutes = require('./routes/unified-leads');
const invoicesRoutes = require('./routes/invoices');
const paymentMethodsRoutes = require('./routes/paymentMethods');
const supportTicketsRoutes = require('./routes/support-tickets');
const aiDashboardRoutes = require('./routes/aiDashboard');
const aiAssistantRoutes = require('./routes/aiAssistant');
const dashboardRoutes = require('./routes/dashboard');
const userSettingsRoutes = require('./routes/userSettings');
const { initializeDatabase } = require('./services/database');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize database
try {
  initializeDatabase();
  console.log('✅ Database initialization attempted');
} catch (error) {
  console.error('❌ Database initialization failed:', error.message);
  console.log('⚠️  Continuing without database - some features may not work');
}

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Allow inline scripts for customer website
      styleSrc: ["'self'", "'unsafe-inline'", "https:"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "https:", "data:"],
      connectSrc: ["'self'", "http://localhost:3001", "http://192.168.0.142:3001", "http://192.168.68.115:3001", "http://192.168.*:3001"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
}));
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL 
    : true, // Allow all origins in development (needed for Expo Go and React Native)
  credentials: true
}));

// Rate limiting - more restrictive in production
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || (process.env.NODE_ENV === 'production' ? 500 : 5000), // Increased for development
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Logging - use combined in production, dev in development
app.use(process.env.NODE_ENV === 'production' ? morgan('combined') : morgan('dev'));

// Compression
app.use(compression());

// Body parsing - special handling for Stripe webhooks
app.use((req, res, next) => {
  if (req.originalUrl === '/api/stripe/webhook') {
    next();
  } else {
    express.json({ limit: '10mb' })(req, res, next);
  }
});
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files (customer website)
app.use(express.static('public'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Marketplace sync status endpoint
app.get('/api/marketplace-sync/status', async (req, res) => {
  try {
    const stats = await marketplaceSyncService.getSyncStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get sync status',
      message: error.message
    });
  }
});

// Manual sync trigger endpoint
app.post('/api/marketplace-sync/trigger', async (req, res) => {
  try {
    await marketplaceSyncService.forceSync();
    res.json({
      success: true,
      message: 'Sync triggered successfully'
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to trigger sync',
      message: error.message
    });
  }
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/contractors', contractorRoutes);
app.use('/api/stripe', stripeRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/ocr', ocrRoutes);
app.use('/api/materials', materialsRoutes);
app.use('/api/sku', skuRoutes);
app.use('/api/yelp', yelpRoutes);
app.use('/api/bls', blsRoutes);
app.use('/api/cost-benchmarks', costBenchmarksRoutes);
app.use('/api/marketplace-leads', marketplaceLeadsRoutes);
app.use('/api/project-leads', projectLeadsRoutes);
app.use('/api/bid-invitations', bidInvitationsRoutes);
app.use('/api/shared-leads', sharedLeadsRoutes);
app.use('/api/unified-leads', unifiedLeadsRoutes);
app.use('/api/invoices', invoicesRoutes);
app.use('/api/payment-methods', paymentMethodsRoutes);
app.use('/api/support-tickets', supportTicketsRoutes);
app.use('/api/ai', aiBudgetForecastRoutes);
app.use('/api/ai', aiExpenseValidationRoutes);
app.use('/api/ai', aiPredictiveAnalyticsRoutes);
app.use('/api/ai', aiDashboardRoutes);
app.use('/api/ai-assistant', aiAssistantRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/user-settings', userSettingsRoutes);
// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      message: err.message,
      details: err.details
    });
  }
  
  if (err.name === 'OpenAIError') {
    return res.status(503).json({
      error: 'AI Service Error',
      message: 'Unable to process lead scoring at this time'
    });
  }
  
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`
  });
});

// Start marketplace sync service
marketplaceSyncService.start();

// Get local IP address for LAN access
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal (loopback) and non-IPv4 addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const LOCAL_IP = getLocalIP();

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 API Base: http://localhost:${PORT}/api`);
  console.log(`🌐 Customer website: http://localhost:${PORT}`);
  console.log(`📱 LAN access: http://${LOCAL_IP}:${PORT}`);
  console.log(`   - Health: http://${LOCAL_IP}:${PORT}/health`);
  console.log(`   - API: http://${LOCAL_IP}:${PORT}/api`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔄 Marketplace sync: Running every 5 minutes`);
});

module.exports = app; 