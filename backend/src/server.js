require('express-async-errors');
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const { v4: uuidv4 } = require('uuid');

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
const leadScoringService = require('./services/leadScoring');
const { initializeDatabase } = require('./services/database');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize database
if (process.env.DATABASE_URL) {
  initializeDatabase();
}

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL 
    : ['http://localhost:8081', 'http://localhost:8082', 'http://192.168.0.201:8081', 'http://192.168.0.201:8082'],
  credentials: true
}));

// Rate limiting - more restrictive in production
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || (process.env.NODE_ENV === 'production' ? 500 : 1000),
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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
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
app.use('/api/ai', aiBudgetForecastRoutes);
app.use('/api/ai', aiExpenseValidationRoutes);
app.use('/api/ai', aiPredictiveAnalyticsRoutes);
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

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 API Base: http://localhost:${PORT}/api`);
  console.log(`📱 Mobile access: http://192.168.0.201:${PORT}/api`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app; 