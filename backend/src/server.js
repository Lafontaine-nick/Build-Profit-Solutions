require('express-async-errors');
const path = require('path');
const { isRenderHosting } = require('./utils/renderEnv');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Puppeteer: keep Chrome under backend/.puppeteer-cache (matches postinstall + Render).
// Cursor and other sandboxes often inject PUPPETEER_CACHE_DIR into a temp dir without the browser binary.
const PUPPETEER_CACHE_IN_APP = path.resolve(__dirname, '..', '.puppeteer-cache');
const incomingPuppeteerCache = (process.env.PUPPETEER_CACHE_DIR || '').trim();
const puppeteerCacheUnsetOrSandbox =
  !incomingPuppeteerCache ||
  /cursor-sandbox|sandbox-cache/i.test(incomingPuppeteerCache);
const onRenderHost = isRenderHosting();
// Render: render.yaml used to set PUPPETEER_CACHE_DIR from $PWD; monorepo / Root Directory mismatches
// leave an empty cache dir while Puppeteer still resolves a missing binary. Always pin to this package dir.
if (onRenderHost) {
  process.env.PUPPETEER_CACHE_DIR = PUPPETEER_CACHE_IN_APP;
} else if (puppeteerCacheUnsetOrSandbox) {
  process.env.PUPPETEER_CACHE_DIR = PUPPETEER_CACHE_IN_APP;
}

function normalizeEnvKey(name) {
  const v = process.env[name];
  if (v == null || typeof v !== 'string') return;
  const t = v.trim().replace(/^["']|["']$/g, '');
  if (t !== v) process.env[name] = t;
}
normalizeEnvKey('SERPAPI_KEY');
normalizeEnvKey('WEBSCRAPINGAPI_KEY');

const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const { v4: uuidv4 } = require('uuid');
const os = require('os');

const leadRoutes = require('./routes/leads');
const contractorRoutes = require('./routes/contractors');
const bpsDirectoryRoutes = require('./routes/bpsDirectory');
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
const googlePlacesContractorsRoutes = require('./routes/googlePlacesContractors');
const geocodeRoutes = require('./routes/geocode');
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
const contractsRoutes = require('./routes/contracts');
const aiDashboardRoutes = require('./routes/aiDashboard');
const aiAssistantRoutes = require('./routes/aiAssistant');
const dashboardRoutes = require('./routes/dashboard');
const userSettingsRoutes = require('./routes/userSettings');
const userWalkthroughsRoutes = require('./routes/userWalkthroughs');
const teamMessagingRoutes = require('./routes/teamMessaging');
const betaFeedbackRoutes = require('./routes/betaFeedback');
const telemetryRoutes = require('./routes/telemetry');
const { initializeDatabase } = require('./services/database');

const app = express();
const PORT = process.env.PORT || 3001;
const PORT2 = 3000; // Secondary port

/** Expo web (localhost) and LAN IPs must call the hosted API during dev; FRONTEND_URL alone blocks them. */
function isAllowedDevBrowserOrigin(origin) {
  try {
    const { hostname } = new URL(origin);
    if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
    const p = hostname.split('.').map((x) => parseInt(x, 10));
    if (p.length !== 4 || p.some((n) => Number.isNaN(n))) return false;
    if (p[0] === 10) return true;
    if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true;
    if (p[0] === 192 && p[1] === 168) return true;
  } catch (_) {
    /* ignore */
  }
  return false;
}

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
  origin(origin, callback) {
    // Same-origin server-side, curl, mobile native fetch — often no Origin header
    if (!origin) {
      return callback(null, true);
    }
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    const fe = (process.env.FRONTEND_URL || '').trim().replace(/\/$/, '');
    const normalized = origin.trim().replace(/\/$/, '');
    if (fe && normalized === fe) {
      return callback(null, true);
    }
    if (isAllowedDevBrowserOrigin(origin)) {
      return callback(null, true);
    }
    console.warn('[cors] blocked origin:', origin);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// Rate limiting - more restrictive in production
// Set DISABLE_API_RATE_LIMIT=true in .env to bypass during local dev.
// In development, a low RATE_LIMIT_MAX_REQUESTS (e.g. 100) is raised to 5000 unless
// RATE_LIMIT_STRICT_DEV=true — the SPA + Find Subcontractors (Places + geocode) share one IP bucket.
const apiRateLimitDisabled =
  process.env.DISABLE_API_RATE_LIMIT === 'true' || process.env.DISABLE_API_RATE_LIMIT === '1';

const isProdNode = process.env.NODE_ENV === 'production';
const strictDevRateLimit =
  process.env.RATE_LIMIT_STRICT_DEV === 'true' || process.env.RATE_LIMIT_STRICT_DEV === '1';
const parsedRateLimitMax = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10);
const defaultRateLimitMax = isProdNode ? 500 : 5000;
let rateLimitMax =
  Number.isFinite(parsedRateLimitMax) && parsedRateLimitMax > 0
    ? parsedRateLimitMax
    : defaultRateLimitMax;
if (!isProdNode && !apiRateLimitDisabled && !strictDevRateLimit && rateLimitMax < 2000) {
  rateLimitMax = 5000;
}

const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000, // 15 minutes
  max: rateLimitMax,
  message: 'Too many requests from this IP, please try again later.',
  skip: () => apiRateLimitDisabled,
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
    express.json({ limit: '25mb' })(req, res, next);
  }
});
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

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
app.use('/api/contractors', bpsDirectoryRoutes);
app.use('/api/contractors', contractorRoutes);
app.use('/api/stripe', stripeRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/ocr', ocrRoutes);
app.use('/api/materials', materialsRoutes);
app.use('/api/sku', skuRoutes);
app.use('/api/yelp', yelpRoutes);
app.use('/api/places', googlePlacesContractorsRoutes);
app.use('/api/geocode', geocodeRoutes);
app.use('/api/bls', blsRoutes);
app.use('/api/cost-benchmarks', costBenchmarksRoutes);
app.use('/api/marketplace-leads', marketplaceLeadsRoutes);
app.use('/api/project-leads', projectLeadsRoutes);
// Legacy demo APIs (not part of product: campaign, sub request, directory pick only).
// Opt in for local experiments: ENABLE_LEGACY_LEAD_APIS=true
if (process.env.ENABLE_LEGACY_LEAD_APIS === 'true') {
  app.use('/api/bid-invitations', bidInvitationsRoutes);
  app.use('/api/shared-leads', sharedLeadsRoutes);
  console.warn('⚠️ ENABLE_LEGACY_LEAD_APIS: bid-invitations + shared-leads routes are mounted');
} else {
  const legacyLeadApisGone = (req, res) => {
    res.status(410).json({
      error: 'Gone',
      message:
        'Legacy bid-invitations and shared-leads APIs are disabled. Product leads use campaign, sub request (project-leads), and directory pick only.',
    });
  };
  app.use('/api/bid-invitations', legacyLeadApisGone);
  app.use('/api/shared-leads', legacyLeadApisGone);
}
app.use('/api/unified-leads', unifiedLeadsRoutes);
app.use('/api/invoices', invoicesRoutes);
app.use('/api/payment-methods', paymentMethodsRoutes);
app.use('/api/support-tickets', supportTicketsRoutes);
app.use('/api/contracts', contractsRoutes);
app.use('/api/ai', aiBudgetForecastRoutes);
app.use('/api/ai', aiExpenseValidationRoutes);
app.use('/api/ai', aiPredictiveAnalyticsRoutes);
app.use('/api/ai', aiDashboardRoutes);
app.use('/api/ai-assistant', aiAssistantRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/user-settings', userSettingsRoutes);
app.use('/api/walkthrough-state', userWalkthroughsRoutes);
app.use('/api/team', teamMessagingRoutes);
app.use('/api/beta-feedback', betaFeedbackRoutes);
app.use('/api/telemetry', telemetryRoutes);
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

// Marketplace sync disabled — BPS targets contractors, developers, and subs only (no homeowner marketplace feed).
// Re-enable with ENABLE_MARKETPLACE_SYNC=true if you restore marketplace ingestion.
if (process.env.ENABLE_MARKETPLACE_SYNC === 'true') {
  marketplaceSyncService.start();
}

// Get local IP address for LAN access
function getLocalIP() {
  try {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        // Skip internal (loopback) and non-IPv4 addresses
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address;
        }
      }
    }
  } catch (err) {
    // os.networkInterfaces() can throw on some systems (Node 25, VPN, sandbox)
    console.warn('⚠️ Could not detect LAN IP, using localhost:', err.message);
  }
  return 'localhost';
}

const LOCAL_IP = getLocalIP();

// Helper function to log server info
function logServerInfo(port) {
  console.log(`🚀 Server running on port ${port}`);
  console.log(`📊 Health check: http://localhost:${port}/health`);
  console.log(`🔗 API Base: http://localhost:${port}/api`);
  console.log(`🌐 Customer website: http://localhost:${port}`);
  console.log(`📱 LAN access: http://${LOCAL_IP}:${port}`);
  console.log(`   - Health: http://${LOCAL_IP}:${port}/health`);
  console.log(`   - API: http://${LOCAL_IP}:${port}/api`);
}

// Verify SKU Search configuration on startup
const serpApiKey = process.env.SERPAPI_KEY;
const webScrapingApiKey = process.env.WEBSCRAPINGAPI_KEY;
const hasSerpApi = Boolean(serpApiKey && serpApiKey !== 'YOUR_SERPAPI_KEY_HERE');
const hasWebScrapingApi = Boolean(
  webScrapingApiKey && webScrapingApiKey !== 'YOUR_WEBSCRAPINGAPI_KEY_HERE'
);

// Create HTTP servers for both ports
const server1 = http.createServer(app);
const server2 = http.createServer(app);

// Start server on primary port (3001)
server1.listen(PORT, '0.0.0.0', () => {
  console.log(`\n${'='.repeat(60)}`);
  logServerInfo(PORT);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔄 Marketplace sync: Running every 5 minutes`);
  
  console.log(`\n✅ SKU Search API ready:`);
  if (hasSerpApi) {
    console.log(`   ✅ SerpAPI configured (real product images & prices)`);
  } else {
    console.log(`   ⚠️  SerpAPI not configured (will use mock data)`);
  }
  if (hasWebScrapingApi) {
    console.log(`   ✅ WebScrapingAPI configured (backup)`);
  }
  if (!hasSerpApi && !hasWebScrapingApi) {
    console.log(`   ⚠️  No API keys configured - SKU search will use mock data only`);
    console.log(`   💡 To enable real data: Configure SERPAPI_KEY in .env file`);
  }
  console.log(`${'='.repeat(60)}\n`);
});

// Start server on secondary port (3000)
server2.listen(PORT2, '0.0.0.0', () => {
  console.log(`\n${'='.repeat(60)}`);
  logServerInfo(PORT2);
  console.log(`${'='.repeat(60)}\n`);
});

module.exports = app; 