module.exports = function(api) {
  // Use forever() instead of true to avoid caching conflicts
  api.cache.forever();
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Reanimated plugin must be last
      'react-native-reanimated/plugin',
    ],
    // Fast Refresh is enabled by default in babel-preset-expo
    // This ensures it stays enabled in development
    env: {
      development: {
        plugins: [
          // Fast Refresh is automatically enabled by babel-preset-expo
          // No additional config needed
        ],
      },
    },
  };
};
