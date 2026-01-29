export const PRODUCTION_CONFIG = {
  // API Configuration
  API_BASE_URL: 'https://build-profit-solutions-backend.onrender.com',
  API_TIMEOUT: 30000,

  // App Configuration
  APP_NAME: 'Build Profit Solutions',
  APP_VERSION: '1.0.0',
  APP_ENVIRONMENT: 'production',

  // Feature Flags
  FEATURES: {
    AI_LEAD_SCORING: true,
    STRIPE_SUBSCRIPTIONS: true,
    PUSH_NOTIFICATIONS: true,
    OFFLINE_MODE: true,
    DATA_EXPORT: true,
  },

  // Analytics and Monitoring
  SENTRY_DSN: process.env.EXPO_PUBLIC_SENTRY_DSN,
  ANALYTICS_ENABLED: true,

  // Cache Configuration
  CACHE_TTL: 5 * 60 * 1000, // 5 minutes
  MAX_CACHE_SIZE: 50, // MB

  // Sync Configuration
  SYNC_INTERVAL: 30 * 1000, // 30 seconds
  MAX_RETRY_ATTEMPTS: 3,

  // Error Reporting
  ERROR_REPORTING_ENABLED: true,
  LOG_LEVEL: 'error',
};
