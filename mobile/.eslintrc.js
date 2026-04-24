module.exports = {
  extends: ['expo'],
  ignorePatterns: ['dist/**', 'coverage/**', 'temp-app/**', 'metro.config.js', 'expo_output.log'],
  rules: {
    'react/jsx-no-duplicate-props': 'error',
    'react/jsx-no-undef': 'error',
    'react/jsx-no-target-blank': 'error',
    'react/jsx-pascal-case': 'error',
    'no-console': 'off',
  },
};
