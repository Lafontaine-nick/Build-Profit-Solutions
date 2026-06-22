// Lightweight jest config for pure (non-RN) util tests. Bypasses the jest-expo
// preset, which currently fails on expo-modules-core polyfills.
module.exports = {
  testEnvironment: 'node',
  rootDir: '.',
  moduleNameMapper: {
    '^react-native$': '<rootDir>/__test_stubs__/react-native.js',
    '^expo-constants$': '<rootDir>/__test_stubs__/expo-constants.js',
    '^@expo/vector-icons$': '<rootDir>/__test_stubs__/expo-vector-icons.js',
    '^@react-native-async-storage/async-storage$': '<rootDir>/__test_stubs__/async-storage.js',
    '/networkDetection$': '<rootDir>/__test_stubs__/networkDetection.js',
    '^@/(.*)$': '<rootDir>/$1',
  },
  setupFiles: ['<rootDir>/jest.util.setup.js'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  transformIgnorePatterns: ['node_modules/(?!(expo|expo-.*|@expo)/)'],
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': [
      'babel-jest',
      {
        presets: ['@babel/preset-typescript'],
        plugins: ['@babel/plugin-transform-modules-commonjs'],
      },
    ],
  },
};
