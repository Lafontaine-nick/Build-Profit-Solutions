module.exports = function(api) {
  const platform = api.caller(caller => caller?.platform);
  const isWeb = platform === 'web';

  return {
    presets: [
      [
        'babel-preset-expo',
        {
          // Hermes cannot parse import.meta; this transforms ESM packages such as
          // yoga-layout before they reach the runtime.
          unstable_transformImportMeta: true,
        },
      ],
    ],
    plugins: isWeb
      ? []
      : [
          // Reanimated 4: transforms live in react-native-worklets; this must be the last plugin.
          'react-native-worklets/plugin',
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
