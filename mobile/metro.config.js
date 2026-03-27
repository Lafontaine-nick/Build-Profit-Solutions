const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

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

const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
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

// Enable Fast Refresh and proper file watching
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
    enabled: true,
  },
};

// Keep Metro cache for better performance (Fast Refresh still works)
// Only clear cache when needed using --clear flag

module.exports = config;
