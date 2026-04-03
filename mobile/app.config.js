import 'dotenv/config';
import { config } from 'dotenv';
import path from 'path';

// Load environment variables - prioritize .env.local for development
config({ path: path.resolve(__dirname, '.env.local') });
config({ path: path.resolve(__dirname, '.env.production') });

// Production store builds set EXPO_PUBLIC_APP_ENV=production (see eas.json). That wins over NODE_ENV.
const isDevelopment =
  process.env.EXPO_PUBLIC_APP_ENV === 'production'
    ? false
    : process.env.NODE_ENV === 'development' ||
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
      // Must increase for every App Store Connect upload (TestFlight). EAS can auto-increment; see eas.json.
      buildNumber: '2',
      // Reanimated 4+ requires New Architecture; required for EAS iOS pod install.
      jsEngine: 'hermes',
      newArchEnabled: true,
      infoPlist: {
        NSMicrophoneUsageDescription: 'This app needs access to your microphone to record voice messages for the AI assistant.',
        NSPhotoLibraryUsageDescription:
          'Allow access to your photo library to attach screenshots to beta feedback and upload project images.',
        // Allow contract PDF fetch to http://<Mac-LAN>:3001 from TestFlight/device (ATS blocks cleartext to LAN by default).
        NSAppTransportSecurity: {
          NSAllowsLocalNetworking: true,
        },
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/images/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
      package: 'com.buildprofitsolutions.mobile',
      // Match iOS: PDF export POST to http://<dev-machine>:3001 on a physical device.
      usesCleartextTraffic: true,
      jsEngine: 'hermes',
      newArchEnabled: true,
      permissions: [
        'android.permission.RECORD_AUDIO',
      ],
    },
    web: {
      favicon: './assets/images/favicon.png',
      bundler: 'metro',
    },
    plugins: [
      'expo-router',
      [
        'expo-image-picker',
        {
          photosPermission:
            'Allow access to your photos to attach screenshots to beta feedback and upload project images.',
        },
      ],
    ],
    newArchEnabled: true,
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
        // Development backend URL for physical devices.
        // Do not hardcode stale LAN IPs; set EXPO_PUBLIC_DEV_API_BASE_URL explicitly when needed.
        devApiBaseUrl: process.env.EXPO_PUBLIC_DEV_API_BASE_URL || '',
        // Optional: PDF render only (e.g. http://192.168.x.x:3001/api). Overrides order in exportContractPdf.
        pdfApiBaseUrl: process.env.EXPO_PUBLIC_PDF_API_BASE_URL || '',
      appEnv: process.env.EXPO_PUBLIC_APP_ENV,
      isDevelopment: isDevelopment,
      // Beta-only in-app feedback (Profile row only). Disable for public launch.
      betaFeedbackEnabled: process.env.EXPO_PUBLIC_BETA_FEEDBACK_ENABLED === 'true',
      betaFeedbackAllowlistEmails: process.env.EXPO_PUBLIC_BETA_FEEDBACK_ALLOWLIST_EMAILS || '',
    },
    runtimeVersion: '1.0.0',
    updates: {
      url: 'https://u.expo.dev/7b85d23d-d01f-48c3-95b0-e1909106a0d0',
    },
  },
};
