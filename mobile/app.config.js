import { config } from 'dotenv';
import path from 'path';

// Load order: base → production file → .env.local last.
// For local development, .env.local should win. For production EAS builds, do not let
// a local override flip EXPO_PUBLIC_APP_ENV back to development during config evaluation.
// Local `eas submit`: set EXPO_PUBLIC_APP_ENV=production first (see npm script submit:ios:production)
// or .env.local will force the .dev bundle and ASC submission will target the wrong app.
const dotenvOpts = { quiet: true };
config({ path: path.resolve(__dirname, '.env'), ...dotenvOpts });
config({ path: path.resolve(__dirname, '.env.production'), ...dotenvOpts });
config({
  path: path.resolve(__dirname, '.env.local'),
  override: process.env.EXPO_PUBLIC_APP_ENV !== 'production',
  ...dotenvOpts,
});

// Store / EAS production sets EXPO_PUBLIC_APP_ENV=production (see eas.json).
// Do NOT infer dev from NODE_ENV here: when Expo evaluates this file, NODE_ENV is often unset,
// which made isDevelopment false, re-enabled EAS Update, and left Expo Go stuck on "downloading…".
const isDevelopment = process.env.EXPO_PUBLIC_APP_ENV !== 'production';
const appDisplayName = isDevelopment
  ? 'Build Profit Solutions (Dev)'
  : 'Build Profit Solutions';
const appScheme = isDevelopment ? 'buildprofitsolutions-dev' : 'buildprofitsolutions';
const iosBundleIdentifier = isDevelopment
  ? 'com.buildprofitsolutions.mobile.dev'
  : 'com.buildprofitsolutions.mobile';
const androidPackage = isDevelopment
  ? 'com.buildprofitsolutions.mobile.dev'
  : 'com.buildprofitsolutions.mobile';

// OTA only during EAS cloud/local builds where we ship production env (see eas.json).
// Local `expo start` does not set EAS_BUILD, so Expo Go won't hang on "downloading…"
// if APP_ENV is wrong in the shell. (EAS_BUILD_PROFILE is not always set on workers.)
const enableProductionEASUpdate =
  process.env.EAS_BUILD === 'true' && process.env.EXPO_PUBLIC_APP_ENV === 'production';

export default {
  expo: {
    name: appDisplayName,
    slug: 'build-profit-solutions-mobile',
    version: '1.0.0',
    // Required whenever expo-updates / Expo.plist sets EXUpdatesRuntimeVersion (EAS builds, prebuild).
    runtimeVersion: '1.0.0',
    sdkVersion: '54.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: appScheme,
    userInterfaceStyle: 'automatic',
    splash: {
      image: './assets/images/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: true,
      bundleIdentifier: iosBundleIdentifier,
      // Must increase for every App Store Connect upload (TestFlight). EAS can auto-increment; see eas.json.
      buildNumber: '2',
      // Reanimated 4+ requires New Architecture; required for EAS iOS pod install.
      jsEngine: 'hermes',
      newArchEnabled: true,
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSCameraUsageDescription:
          'Allow camera access to scan product barcodes and QR codes for estimates, budgets, change orders, and purchase orders.',
        NSMicrophoneUsageDescription: 'This app needs access to your microphone to record voice messages for the AI assistant.',
        NSPhotoLibraryUsageDescription:
          'Allow access to your photo library to attach screenshots to beta feedback and upload project images.',
        // Allow contract PDF fetch to http://<Mac-LAN>:3001 from TestFlight/device (ATS blocks cleartext to LAN by default).
        NSAppTransportSecurity: {
          NSAllowsLocalNetworking: true,
        },
        NSLocalNetworkUsageDescription:
          'Build Profit Solutions uses your local network to reach your development server on Wi‑Fi for receipts, estimates, and the API.',
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/images/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
      package: androidPackage,
      // Match iOS: PDF export POST to http://<dev-machine>:3001 on a physical device.
      usesCleartextTraffic: true,
      jsEngine: 'hermes',
      newArchEnabled: true,
      permissions: [
        'android.permission.CAMERA',
        'android.permission.RECORD_AUDIO',
      ],
    },
    web: {
      favicon: './assets/images/favicon.png',
      bundler: 'metro',
    },
    plugins: [
      'expo-dev-client',
      'expo-router',
      'expo-web-browser',
      [
        'expo-location',
        {
          locationWhenInUsePermission:
            'Allow location access to find subcontractors near your current area.',
        },
      ],
      [
        'expo-camera',
        {
          cameraPermission:
            'Allow camera access to scan product barcodes and QR codes for estimates, budgets, change orders, and purchase orders.',
        },
      ],
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
      // When true, Find Subcontractors calls /api/yelp/search (requires YELP_API_KEY on backend). Default off until you subscribe to Yelp.
      yelpSubSearchEnabled: process.env.EXPO_PUBLIC_YELP_SUB_SEARCH_ENABLED === 'true',
    },
    // EAS Update: only EAS production store builds. All other cases (Expo Go, dev client, local) stay off.
    ...(enableProductionEASUpdate
      ? {
          updates: {
            url: 'https://u.expo.dev/7b85d23d-d01f-48c3-95b0-e1909106a0d0',
          },
        }
      : {
          updates: {
            enabled: false,
            checkAutomatically: 'NEVER',
          },
        }),
  },
};
