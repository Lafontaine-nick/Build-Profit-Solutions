import 'dotenv/config';
import { config } from 'dotenv';
import path from 'path';

// Load environment variables - prioritize .env.local for development
config({ path: path.resolve(__dirname, '.env.local') });
config({ path: path.resolve(__dirname, '.env.production') });

// Determine if we're in development mode
const isDevelopment =
  process.env.NODE_ENV === 'development' ||
  process.env.EXPO_PUBLIC_APP_ENV === 'development';

export default {
  expo: {
    name: isDevelopment
      ? 'Build Profit Solutions (Dev)'
      : 'Build Profit Solutions',
    slug: 'build-profit-solutions-mobile',
    version: '1.0.0',
    sdkVersion: '54.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'buildprofitsolutions',
    userInterfaceStyle: 'automatic',
    splash: {
      image: './assets/images/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.buildprofitsolutions.mobile',
      // Explicitly disable new architecture
      jsEngine: 'hermes',
      newArchEnabled: false,
      infoPlist: {
        NSMicrophoneUsageDescription: 'This app needs access to your microphone to record voice messages for the AI assistant.',
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/images/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
      package: 'com.buildprofitsolutions.mobile',
      // Explicitly disable new architecture
      jsEngine: 'hermes',
      newArchEnabled: false,
      permissions: [
        'android.permission.RECORD_AUDIO',
      ],
    },
    web: {
      favicon: './assets/images/favicon.png',
      bundler: 'metro',
    },
    plugins: ['expo-router'],
    // Disable New Architecture for Expo Go compatibility
    newArchEnabled: false,
    extra: {
      router: {
        origin: false,
      },
      eas: {
        projectId: '7b85d23d-d01f-48c3-95b0-e1909106a0d0',
      },
      // Make environment variables available to the app
      clerkPublishableKey: process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
      stripePublishableKey: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY,
        // ROOT CAUSE FIX: Always default to production backend
        // The app will work without local backend running
        // To use local backend, explicitly set: EXPO_PUBLIC_API_BASE_URL=http://192.168.0.201:3001/api
        apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL || 'https://build-profit-solutions-backend.onrender.com/api',
        // Development network IP for mobile physical devices
        // CURRENT IP: 192.168.1.115 (updated via ifconfig)
        devApiBaseUrl: process.env.EXPO_PUBLIC_DEV_API_BASE_URL || 'http://192.168.1.115:3001',
      appEnv: process.env.EXPO_PUBLIC_APP_ENV,
      isDevelopment: isDevelopment,
    },
    runtimeVersion: '1.0.0',
    updates: {
      url: 'https://u.expo.dev/7b85d23d-d01f-48c3-95b0-e1909106a0d0',
    },
  },
};
