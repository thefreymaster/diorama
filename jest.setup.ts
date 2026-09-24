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

// Jest loads gesture-handler's prebuilt CommonJS build, where the worklets Babel
// plugin can't spot `_.Gesture.Pan()` callbacks, so ReanimatedSwipeable logs "some
// callbacks are worklets and some are not". Metro uses its TypeScript source, which
// is fine; use that here too.
jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () =>
  jest.requireActual('react-native-gesture-handler/src/components/ReanimatedSwipeable'),
);

// react-native-mmkv v4 reaches native code through Nitro. Under Jest, MMKV
// switches to its own in-memory store, so Nitro only has to import cleanly.
jest.mock('react-native-nitro-modules', () => ({
  NitroModules: {
    createHybridObject: (name: string) => {
      throw new Error(`Nitro module "${name}" is not available in Jest.`);
    },
  },
}));

// expo-location talks to Core Location. Keep its real enums and types, and
// swap the calls the app makes for mocks that never find anyone: Location
// Services on, access not asked yet, "Don't Allow" if asked. Tests that
// locate set their own answers (`jest.mocked(Location.getCurrentPositionAsync)`).
jest.mock('expo-location', () => {
  const permission = (status: 'granted' | 'denied' | 'undetermined') => ({
    status,
    granted: status === 'granted',
    canAskAgain: status !== 'denied',
    expires: 'never',
  });
  return {
    ...jest.requireActual<object>('expo-location'),
    hasServicesEnabledAsync: jest.fn(async () => true),
    getForegroundPermissionsAsync: jest.fn(async () => permission('undetermined')),
    requestForegroundPermissionsAsync: jest.fn(async () => permission('denied')),
    getCurrentPositionAsync: jest.fn(async () => {
      throw new Error('No location in Jest.');
    }),
    reverseGeocodeAsync: jest.fn(async () => []),
  };
});

setUpTests();
