/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/src/test/setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^react-native-mmkv$': '<rootDir>/src/test/mocks/mmkv.ts',
    '^expo-secure-store$': '<rootDir>/src/test/mocks/secureStore.ts',
    '^@sentry/react-native$': '<rootDir>/src/test/mocks/sentry.ts',
  },
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/dist-screens/', '/scripts/'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/__tests__/**',
    '!src/test/**',
    '!src/types/**',
  ],
};
