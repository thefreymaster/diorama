import { focusManager } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { act, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';
import { SymbolView } from 'expo-symbols';
import { AccessibilityInfo, Linking } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import type { ReactTestInstance } from 'react-test-renderer';

import {
  addRecent,
  clearRecents,
  getRecents,
  type RecentCity,
} from '@/features/cities/recentsStore';
import { queryClient } from '@/providers/queryClient';

import * as CityRoute from '../../../../app/city/[cityId]';
import * as IndexRoute from '../../../../app/index';
import * as RootLayout from '../../../../app/_layout';
import * as SettingsRoute from '../../../../app/settings';
import * as ViewerRoute from '../../../../app/view/[cityId]';

// The Swift search functions; everything else in the module stays real.
jest.mock('@diorama/native', () => ({
  ...jest.requireActual('@diorama/native'),
  autocomplete: jest.fn(() => Promise.resolve([])),
  resolve: jest.fn(),
}));

// expo-location is mocked in jest.setup.ts; each test sets the answers it needs.
const mockServicesEnabled = jest.mocked(Location.hasServicesEnabledAsync);
const mockGetPermission = jest.mocked(Location.getForegroundPermissionsAsync);
const mockRequestPermission = jest.mocked(Location.requestForegroundPermissionsAsync);
const mockPosition = jest.mocked(Location.getCurrentPositionAsync);
const mockReverseGeocode = jest.mocked(Location.reverseGeocodeAsync);

const routes = {
  _layout: RootLayout,
  index: IndexRoute,
  'city/[cityId]': CityRoute,
  'view/[cityId]': ViewerRoute,
  settings: SettingsRoute,
};

const { GRANTED, DENIED, UNDETERMINED } = Location.PermissionStatus;

function permission(status: Location.PermissionStatus): Location.LocationPermissionResponse {
  return { status, granted: status === GRANTED, canAskAgain: status !== DENIED, expires: 'never' };
}

/** Boston City Hall Plaza, as the Simulator is told to report it. */
const BOSTON: Location.LocationObject = {
  coords: {
    latitude: 42.3601,
    longitude: -71.0589,
    accuracy: 5,
    altitude: null,
    altitudeAccuracy: null,
    heading: null,
    speed: null,
  },
  timestamp: 0,
};

const CITY_HALL: Location.LocationGeocodedAddress = {
  name: '1 City Hall Sq',
  streetNumber: '1',
  street: 'City Hall Sq',
  city: 'Boston',
  district: null,
  subregion: 'Suffolk County',
  region: 'MA',
  country: 'United States',
  postalCode: '02201',
  isoCountryCode: 'US',
  timezone: null,
  formattedAddress: null,
};

const CITY_HALL_ID = '1-city-hall-sq_42.360_-71.059';

const ROME: RecentCity = {
  id: 'rome',
  name: 'Rome',
  country: 'Italy',
  lat: 41.9,
  lon: 12.5,
  altitude: 1500,
};

/** A promise the test settles by hand, to hold a fix "in flight". */
function deferred<T>() {
  let settle: (value: T) => void = () => {};
  const promise = new Promise<T>((resolvePromise) => {
    settle = resolvePromise;
  });
  return { promise, settle };
}

function findHostNode(type: string): ReactTestInstance {
  return screen.UNSAFE_root.find((node) => node.type === type);
}

/** What UIKit reports when the Settings bar button is tapped. */
function pressSettingsButton() {
  const header = findHostNode('RNSScreenStackHeaderConfig');
  const items: { accessibilityLabel?: string; buttonId: string }[] =
    header.props.headerRightBarButtonItems;
  const gear = items.find((item) => item.accessibilityLabel === 'Settings');
  fireEvent(header, 'pressHeaderBarButtonItem', { nativeEvent: { buttonId: gear?.buttonId } });
}

/** The "Current location" row. */
function currentLocationRow(): ReactTestInstance {
  return screen.getByRole('button', { name: /^Current location/ });
}

beforeEach(() => {
  queryClient.clear();
  clearRecents();
  mockServicesEnabled.mockReset().mockResolvedValue(true);
  mockGetPermission.mockReset().mockResolvedValue(permission(UNDETERMINED));
  mockRequestPermission.mockReset().mockResolvedValue(permission(GRANTED));
  mockPosition.mockReset().mockResolvedValue(BOSTON);
  mockReverseGeocode.mockReset().mockResolvedValue([CITY_HALL]);
});

describe('current location row', () => {
  it('sits above Recent, with the location glyph, and never asks at launch', async () => {
    addRecent(ROME);
    renderRouter(routes, { initialUrl: '/' });

    expect(await screen.findByText('Current location')).toBeOnTheScreen();
    // Row glyphs top to bottom: the location arrow comes before Recent's clock.
    const symbols = screen.UNSAFE_getAllByType(SymbolView).map((symbol) => symbol.props.name);
    expect(symbols.indexOf('location.fill')).toBeGreaterThanOrEqual(0);
    expect(symbols.indexOf('location.fill')).toBeLessThan(symbols.indexOf('clock.fill'));
    // The section has no header of its own.
    expect(screen.getAllByRole('header').map((header) => header.props.children)).toEqual([
      'Recent',
      'Featured',
    ]);
    // Reading the access is fine; asking or looking waits for a tap.
    await waitFor(() => expect(mockGetPermission).toHaveBeenCalled());
    expect(mockRequestPermission).not.toHaveBeenCalled();
    expect(mockPosition).not.toHaveBeenCalled();
  });

  it('is not swipe-deletable', async () => {
    addRecent(ROME);
    renderRouter(routes, { initialUrl: '/' });

    await screen.findByText('Current location');
    const swipeables = screen.UNSAFE_getAllByType(ReanimatedSwipeable);
    for (const swipeable of swipeables) {
      expect(within(swipeable).queryByText('Current location')).toBeNull();
    }
  });

  it('opens the preview where you are, and the spot joins Recent', async () => {
    const router = renderRouter(routes, { initialUrl: '/' });

    fireEvent.press(await screen.findByText('Current location'));

    expect(await screen.findByTestId('city-preview-screen')).toBeOnTheScreen();
    expect(router.getPathname()).toBe(`/city/${CITY_HALL_ID}`);
    expect(getRecents()).toEqual([
      {
        id: CITY_HALL_ID,
        name: '1 City Hall Sq',
        country: 'Boston, United States',
        lat: 42.3601,
        lon: -71.0589,
        altitude: 700,
      },
    ]);
    expect(mockPosition).toHaveBeenCalledWith({ accuracy: Location.Accuracy.Balanced });
  });

  it('says it is locating and ignores more taps meanwhile', async () => {
    const pending = deferred<Location.LocationObject>();
    mockPosition.mockReturnValue(pending.promise);
    const router = renderRouter(routes, { initialUrl: '/' });

    fireEvent.press(await screen.findByText('Current location'));
    expect(await screen.findByText('Locating…')).toBeOnTheScreen();
    fireEvent.press(currentLocationRow());
    fireEvent.press(currentLocationRow());

    expect(mockRequestPermission).toHaveBeenCalledTimes(1);
    await act(async () => pending.settle(BOSTON));
    expect(router.getPathname()).toBe(`/city/${CITY_HALL_ID}`);
  });

  it('says access is off when denied, and then a tap opens Settings', async () => {
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    mockRequestPermission.mockResolvedValue(permission(DENIED));
    const router = renderRouter(routes, { initialUrl: '/' });

    fireEvent.press(await screen.findByText('Current location'));

    expect(await screen.findByText('Location access is off')).toBeOnTheScreen();
    expect(announce).toHaveBeenCalledWith('Location access is off');
    expect(openSettings).not.toHaveBeenCalled();

    fireEvent.press(currentLocationRow());

    expect(openSettings).toHaveBeenCalledTimes(1);
    expect(mockRequestPermission).toHaveBeenCalledTimes(1);
    expect(mockPosition).not.toHaveBeenCalled();
    expect(router.getPathname()).toBe('/');
    expect(getRecents()).toEqual([]);
    openSettings.mockRestore();
    announce.mockRestore();
  });

  it('says access is off from the start when it was turned off before', async () => {
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    mockGetPermission.mockResolvedValue(permission(DENIED));
    renderRouter(routes, { initialUrl: '/' });

    expect(await screen.findByText('Location access is off')).toBeOnTheScreen();
    expect(currentLocationRow().props.accessibilityHint).toBe('Opens Settings.');
    fireEvent.press(currentLocationRow());

    expect(openSettings).toHaveBeenCalledTimes(1);
    expect(mockRequestPermission).not.toHaveBeenCalled();
    openSettings.mockRestore();
  });

  it('clears "Location access is off" once it is turned on in Settings', async () => {
    mockGetPermission.mockResolvedValue(permission(DENIED));
    const router = renderRouter(routes, { initialUrl: '/' });
    expect(await screen.findByText('Location access is off')).toBeOnTheScreen();

    // Off to Settings, and back with "While Using the App" picked.
    act(() => focusManager.setFocused(false));
    mockGetPermission.mockResolvedValue(permission(GRANTED));
    act(() => focusManager.setFocused(true));

    await waitFor(() => expect(screen.queryByText('Location access is off')).toBeNull());
    fireEvent.press(currentLocationRow());
    await waitFor(() => expect(router.getPathname()).toBe(`/city/${CITY_HALL_ID}`));
    act(() => focusManager.setFocused(undefined));
  });

  it('says quietly when it finds nothing, and a tap tries again', async () => {
    mockPosition.mockRejectedValueOnce(new Error('Cannot obtain current location'));
    const router = renderRouter(routes, { initialUrl: '/' });

    fireEvent.press(await screen.findByText('Current location'));

    expect(await screen.findByText("Can't find your location")).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/');

    fireEvent.press(currentLocationRow());

    await waitFor(() => expect(router.getPathname()).toBe(`/city/${CITY_HALL_ID}`));
    expect(mockPosition).toHaveBeenCalledTimes(2);
  });

  it('says it can not find you with Location Services off, without asking', async () => {
    mockServicesEnabled.mockResolvedValue(false);
    renderRouter(routes, { initialUrl: '/' });

    fireEvent.press(await screen.findByText('Current location'));

    expect(await screen.findByText("Can't find your location")).toBeOnTheScreen();
    expect(mockRequestPermission).not.toHaveBeenCalled();
  });

  it('does not open the preview if you left while it looked', async () => {
    const pending = deferred<Location.LocationObject>();
    mockPosition.mockReturnValue(pending.promise);
    const router = renderRouter(routes, { initialUrl: '/' });

    fireEvent.press(await screen.findByText('Current location'));
    await screen.findByText('Locating…');
    act(() => pressSettingsButton());
    await act(async () => pending.settle(BOSTON));

    expect(router.getPathname()).toBe('/settings');
    expect(getRecents()).toEqual([]);
  });

  it('is hidden while searching', async () => {
    renderRouter(routes, { initialUrl: '/?q=par' });

    await waitFor(() => expect(screen.getByTestId('city-picker-screen')).toBeOnTheScreen());
    expect(screen.queryByText('Current location')).toBeNull();
  });
});
