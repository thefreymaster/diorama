// Runs before every test file (see jest.config.js `setupFilesAfterEnv`).
// Native-module mocks shared by all tests live here.
import 'react-native-gesture-handler/jestSetup';
import { setUpTests } from 'react-native-reanimated';

// Reanimated 4 runs on react-native-worklets, which needs its native runtime.
// Swap in the JS mock that ships with the package.
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));

// `expo-router/testing-library` replaces Reanimated with `react-native-reanimated/mock`,
// which has no `useReducedMotion`, so any screen with a PrimaryButton, GlassButton or
// SkeletonRow crashes under `renderRouter`. Point that mock at the real library
// (made Jest-safe by `setUpTests()` below), so route tests and unit tests match.
jest.mock('react-native-reanimated/mock', () => jest.requireActual('react-native-reanimated'));

// react-native-mmkv v4 reaches native code through Nitro. Under Jest, MMKV
// switches to its own in-memory store, so Nitro only has to import cleanly.
jest.mock('react-native-nitro-modules', () => ({
  NitroModules: {
    createHybridObject: (name: string) => {
      throw new Error(`Nitro module "${name}" is not available in Jest.`);
    },
  },
}));

setUpTests();
