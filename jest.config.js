/** @type {import('jest').Config} */
module.exports = {
  // iOS-only app: resolve `.ios.tsx` files and use the iOS React Native mocks.
  preset: 'jest-expo/ios',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  // Mirror the tsconfig.json `paths` aliases.
  moduleNameMapper: {
    '^@/assets/(.*)$': '<rootDir>/assets/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@diorama/native$': '<rootDir>/modules/diorama-native',
  },
  // Watchman can hang in sandboxed shells; the node crawler is plenty for this repo.
  watchman: false,
  testPathIgnorePatterns: ['/node_modules/', '/ios/', '/android/', '/.expo/'],
};
