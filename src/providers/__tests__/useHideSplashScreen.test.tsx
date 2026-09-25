import * as Location from 'expo-location';
import { renderRouter, screen, waitFor } from 'expo-router/testing-library';
import * as SplashScreen from 'expo-splash-screen';
import { act, renderHook } from '@testing-library/react-native';

import * as IndexRoute from '../../../app/index';
import * as RootLayout from '../../../app/_layout';
import { useHideSplashScreen } from '../useHideSplashScreen';

// Only the synchronous hide matters here: expo-router's own (async) hide
// goes through the native module, not this package's JS.
jest.mock('expo-splash-screen', () => ({ hide: jest.fn() }));

// The Swift search functions; everything else in the module stays real.
jest.mock('@diorama/native', () => ({
  ...jest.requireActual('@diorama/native'),
  autocomplete: jest.fn(() => Promise.resolve([])),
  resolve: jest.fn(),
}));

const mockHide = jest.mocked(SplashScreen.hide);

// The first render loads the route files, slow on a cold Jest cache.
const FIRST_RENDER_TIMEOUT_MS = 10_000;

beforeEach(() => {
  mockHide.mockClear();
});

describe('useHideSplashScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('lifts the launch screen one frame after the first screen commits', () => {
    renderHook(() => useHideSplashScreen());
    expect(mockHide).not.toHaveBeenCalled();

    act(() => {
      jest.runOnlyPendingTimers();
    });
    expect(mockHide).toHaveBeenCalledTimes(1);
  });

  it('hides only once, however often the layout renders', () => {
    const { rerender } = renderHook(() => useHideSplashScreen());
    rerender({});
    rerender({});
    act(() => {
      jest.runOnlyPendingTimers();
    });
    expect(mockHide).toHaveBeenCalledTimes(1);
  });

  it('does nothing once unmounted', () => {
    const { unmount } = renderHook(() => useHideSplashScreen());
    unmount();
    act(() => {
      jest.runOnlyPendingTimers();
    });
    expect(mockHide).not.toHaveBeenCalled();
  });
});

describe('launch (T48)', () => {
  const mockServicesEnabled = jest.mocked(Location.hasServicesEnabledAsync);

  afterEach(() => {
    mockServicesEnabled.mockReset();
    mockServicesEnabled.mockImplementation(async () => true);
  });

  it(
    'lifts the splash while Core Location never answers the picker',
    async () => {
      // Like the iOS 26.5 Simulator after a boot: the location-access read
      // never settles (natively it holds up every other async native call).
      mockServicesEnabled.mockImplementation(() => new Promise<boolean>(() => {}));

      renderRouter({ _layout: RootLayout, index: IndexRoute }, { initialUrl: '/' });

      expect(
        await screen.findByText('Featured', {}, { timeout: FIRST_RENDER_TIMEOUT_MS }),
      ).toBeOnTheScreen();
      expect(mockServicesEnabled).toHaveBeenCalled();
      await waitFor(() => expect(mockHide).toHaveBeenCalledTimes(1));
    },
    FIRST_RENDER_TIMEOUT_MS + 5_000,
  );
});
