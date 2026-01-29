module.exports = {
  extends: ['expo', '@react-native'],
  plugins: ['@typescript-eslint', 'react', 'react-native', 'react-hooks'],
  ignorePatterns: ['dist/**', 'coverage/**', 'temp-app/**', 'metro.config.js', 'expo_output.log'],
  rules: {
    // Prevent common syntax errors
    'react/jsx-no-duplicate-props': 'error',
    'react/jsx-no-undef': 'error',
    'react/jsx-uses-react': 'error',
    'react/jsx-uses-vars': 'error',
    'no-unused-vars': 'warn',
    'no-console': 'warn',
    // JSX specific rules
    'react/jsx-closing-bracket-location': 'error',
    'react/jsx-closing-tag-location': 'error',
    'react/jsx-curly-spacing': 'error',
    'react/jsx-equals-spacing': 'error',
    'react/jsx-indent': ['error', 2],
    'react/jsx-indent-props': ['error', 2],
    'react/jsx-max-props-per-line': ['error', { maximum: 1 }],
    'react/jsx-no-bind': 'warn',
    'react/jsx-no-literals': 'off',
    'react/jsx-no-target-blank': 'error',
    'react/jsx-pascal-case': 'error',
    'react/jsx-sort-props': 'off',
    'react/jsx-tag-spacing': 'error',
    'react/jsx-wrap-multilines': 'error',
  },
};
