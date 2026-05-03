const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

/**
 * Metro can bundle more than one physical copy of `@clerk/clerk-react` / `@clerk/shared`.
 * Clerk contexts are module-singletons — duplicates cause `AuthContext not found` on web.
 */
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  '@clerk/clerk-react': path.join(__dirname, 'node_modules', '@clerk/clerk-react'),
  '@clerk/shared': path.join(__dirname, 'node_modules', '@clerk/shared'),
};

/**
 * @react-pdf packages ship separate browser builds (no `fs`). Metro's resolver
 * must use them on native; otherwise the Node entry fails at runtime.
 */
const reactPdfBrowserEntry = require.resolve(
  '@react-pdf/renderer/lib/react-pdf.browser.js',
);
const pdfkitBrowserEntry = require.resolve('@react-pdf/pdfkit/lib/pdfkit.browser.js');
const imageBrowserEntry = require.resolve('@react-pdf/image/lib/index.browser.js');
const pngJsBrowserEntry = require.resolve('@react-pdf/png-js/lib/png-js.browser.js');
const yogaShimEntry = require.resolve('./lib/proposals/reactPdfYogaShim.js');
const reanimatedWebShimEntry = require.resolve('./shims/reactNativeReanimated.web.js');
const workletsWebShimEntry = require.resolve('./shims/reactNativeWorklets.web.js');
const expoBlurWebEntry = require.resolve('./shims/expoBlur.web.tsx');

/** Prefer compiled JS: package "react-native" field points at ./src (TS); Metro can leave stale edges to removed paths (e.g. 0.8.x src/memory/*) after version changes. */
const workletsLibEntry = require.resolve('react-native-worklets/lib/module/index.js');

/** Absolute main entries — `extraNodeModules` alone can still yield duplicate instances on web. */
const clerkReactMainEntry = path.join(
  __dirname,
  'node_modules',
  '@clerk',
  'clerk-react',
  'dist',
  'index.js',
);
const clerkSharedMainEntry = path.join(
  __dirname,
  'node_modules',
  '@clerk',
  'shared',
  'dist',
  'index.js',
);

const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@clerk/clerk-react') {
    return { type: 'sourceFile', filePath: clerkReactMainEntry };
  }
  if (moduleName === '@clerk/shared') {
    return { type: 'sourceFile', filePath: clerkSharedMainEntry };
  }
  if (platform === 'web' && moduleName === 'react-native-reanimated') {
    return { filePath: reanimatedWebShimEntry, type: 'sourceFile' };
  }
  if (platform === 'web' && moduleName === 'react-native-worklets') {
    return { filePath: workletsWebShimEntry, type: 'sourceFile' };
  }
  if (platform === 'web' && moduleName === 'expo-blur') {
    return { filePath: expoBlurWebEntry, type: 'sourceFile' };
  }
  if (moduleName === 'react-native-worklets') {
    return { filePath: workletsLibEntry, type: 'sourceFile' };
  }
  if (moduleName === '@react-pdf/renderer') {
    return { filePath: reactPdfBrowserEntry, type: 'sourceFile' };
  }
  if (moduleName === '@react-pdf/pdfkit') {
    return { filePath: pdfkitBrowserEntry, type: 'sourceFile' };
  }
  if (moduleName === '@react-pdf/image') {
    return { filePath: imageBrowserEntry, type: 'sourceFile' };
  }
  if (moduleName === '@react-pdf/png-js') {
    return { filePath: pngJsBrowserEntry, type: 'sourceFile' };
  }
  if (moduleName === 'yoga-layout/load') {
    return { filePath: yogaShimEntry, type: 'sourceFile' };
  }
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

// Ensure proper resolution of modules
config.resolver.platforms = ['ios', 'android', 'native', 'web'];

// Configure transformer for Fast Refresh
config.transformer = {
  ...config.transformer,
  getTransformOptions: async () => ({
    transform: {
      experimentalImportSupport: false,
      inlineRequires: true,
    },
  }),
  // Allow Fast Refresh even with TypeScript errors
  unstable_allowRequireContext: true,
  // Enable Fast Refresh
  unstable_disableES6Transforms: false,
  // Explicitly enable Fast Refresh
  enableBabelRCLookup: false,
};

config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => {
    return (req, res, next) => {
      // Allow cache but ensure fresh updates for hot reload
      if (req.url && (req.url.includes('.bundle') || req.url.includes('index.bundle'))) {
        res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
      }
      // Enable Fast Refresh headers
      if (req.url && req.url.includes('hot')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
      return middleware(req, res, next);
    };
  },
};

// Ensure proper file watching for hot reload
config.watchFolders = [__dirname];

// Enable proper file watching
config.watcher = {
  watchman: {
    deferStates: ['hg.update'],
  },
  healthCheck: {
    enabled: false,
  },
};

// Keep Metro cache for better performance (Fast Refresh still works)
// Only clear cache when needed using --clear flag

module.exports = config;
