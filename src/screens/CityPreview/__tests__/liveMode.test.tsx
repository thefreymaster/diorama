import * as Location from 'expo-location';
import {
  act,
  fireEvent,
  renderRouter,
  screen,
  testRouter,
  waitFor,
} from 'expo-router/testing-library';
import { AppState, type AppStateStatus } from 'react-native';

import type { Coordinate, DioramaMapViewProps } from '@diorama/native';
import { addRecent, clearRecents, type RecentCity } from '@/features/cities/recentsStore';
import { LIVE_WATCH_OPTIONS } from '@/features/location/useLiveLocation';
import { queryClient } from '@/providers/queryClient';

import * as CityRoute from '../../../../app/city/[cityId]';
import * as IndexRoute from '../../../../app/index';
import * as RootLayout from '../../../../app/_layout';
import * as SettingsRoute from '../../../../app/settings';
import * as ViewerRoute from '../../../../app/view/[cityId]';
import { FOLLOWING_NOTE } from '../FollowingNote';

// Every `followTo` the maps get, as `[map testID, latitude, longitude]`.
const mockFollowTo = jest.fn((_map: string, _latitude: number, _longitude: number) =>
  Promise.resolve(),
);

// The native map becomes a plain view that keeps its props, with a ref
// whose `followTo` reports which map it came from (preview or Viewer).
jest.mock('@diorama/native', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  function MockDioramaMapView({ ref, ...props }: DioramaMapViewProps) {
    const testID = props.testID ?? 'diorama-map';
    React.useImperativeHandle(ref, () => ({
      recenter: () => Promise.resolve(),
      setDebugLook: () => Promise.resolve(),
      beginZoom: () => Promise.resolve(),
      setZoom: () => Promise.resolve(),
      endZoom: () => Promise.resolve(),
      resetZoom: () => Promise.resolve(),
      followTo: (latitude: number, longitude: number) => mockFollowTo(testID, latitude, longitude),
    }));
    return React.createElement(View, { ...props, testID });
  }
  return {
    ...jest.requireActual<object>('@diorama/native'),
    DioramaMapView: MockDioramaMapView,
    autocomplete: jest.fn(() => Promise.resolve([])),
    resolve: jest.fn(),
  };
});

jest.mock('expo-keep-awake', () => ({ useKeepAwake: jest.fn() }));

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

function fixAt(
  { latitude, longitude }: Coordinate,
  accuracy: number | null,
): Location.LocationObject {
  return {
    coords: {
      latitude,
      longitude,
      accuracy,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
    },
    timestamp: 0,
  };
}

// The Simulator's route: Boston City Hall Plaza to the Common.
const CITY_HALL: Coordinate = { latitude: 42.3601, longitude: -71.0589 };
const TREMONT: Coordinate = { latitude: 42.3578, longitude: -71.0613 };
const COMMON: Coordinate = { latitude: 42.3555, longitude: -71.064 };

const CITY_HALL_ADDRESS: Location.LocationGeocodedAddress = {
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

// Where "Current location" opens, as it lands in Recent.
const HERE: RecentCity = {
  id: '1-city-hall-sq_42.360_-71.059',
  name: '1 City Hall Sq',
  country: 'Boston, United States',
  lat: 42.3601,
  lon: -71.0589,
  altitude: 700,
};

// Core Location's watches, as the app starts and stops them.
type Watch = {
  options: Location.LocationOptions;
  onLocation: Location.LocationCallback;
  removed: boolean;
};
let watches: Watch[] = [];

function activeWatches(): Watch[] {
  return watches.filter((watch) => !watch.removed);
}

/** The phone reports a fix (accuracy in meters) to every running watch. */
function moveTo(spot: Coordinate, accuracy: number | null = 5) {
  act(() => activeWatches().forEach((watch) => watch.onLocation(fixAt(spot, accuracy))));
}

// Location access as the Settings app has it; the prompt changes it.
let access: Location.PermissionStatus = UNDETERMINED;
let appStateListeners: ((state: AppStateStatus) => void)[] = [];

function setAppState(state: AppStateStatus) {
  act(() => appStateListeners.forEach((listener) => listener(state)));
}

function mapProps(testID: 'diorama-map' | 'viewer-map'): DioramaMapViewProps {
  return screen.getByTestId(testID, { includeHiddenElements: true }).props as DioramaMapViewProps;
}

/** The Viewer's VoiceOver "Exit" action, which goes where a hold does. */
function exitViewer() {
  act(() => {
    fireEvent(screen.getByTestId('viewer-screen'), 'accessibilityAction', {
      nativeEvent: { actionName: 'exit' },
    });
  });
}

beforeEach(() => {
  queryClient.clear();
  clearRecents();
  mockFollowTo.mockClear();
  watches = [];
  access = UNDETERMINED;
  appStateListeners = [];
  jest.mocked(Location.hasServicesEnabledAsync).mockReset().mockResolvedValue(true);
  jest
    .mocked(Location.getForegroundPermissionsAsync)
    .mockReset()
    .mockImplementation(async () => permission(access));
  jest
    .mocked(Location.requestForegroundPermissionsAsync)
    .mockReset()
    .mockImplementation(async () => {
      access = GRANTED;
      return permission(access);
    });
  jest.mocked(Location.getCurrentPositionAsync).mockReset().mockResolvedValue(fixAt(CITY_HALL, 5));
  jest.mocked(Location.reverseGeocodeAsync).mockReset().mockResolvedValue([CITY_HALL_ADDRESS]);
  jest.spyOn(Location, 'watchPositionAsync').mockImplementation(async (options, onLocation) => {
    const watch: Watch = { options, onLocation, removed: false };
    watches.push(watch);
    return { remove: () => (watch.removed = true) };
  });
  const addEventListener = (event: string, listener: (state: AppStateStatus) => void) => {
    if (event === 'change') appStateListeners.push(listener);
    return { remove: () => (appStateListeners = appStateListeners.filter((l) => l !== listener)) };
  };
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation(addEventListener as unknown as typeof AppState.addEventListener);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('live mode', () => {
  it('opens from Current location, follows you in the preview and on into the Viewer', async () => {
    const router = renderRouter(routes, { initialUrl: '/' });

    fireEvent.press(await screen.findByText('Current location'));

    expect(await screen.findByTestId('city-preview-screen')).toBeOnTheScreen();
    expect(router.getPathnameWithParams()).toBe(`/city/${HERE.id}?live=1`);
    expect(screen.getByText(FOLLOWING_NOTE)).toBeOnTheScreen();
    expect(mapProps('diorama-map').showsUserLocation).toBe(true);
    // GPS-grade fixes every few steps, and one watch at a time.
    await waitFor(() => expect(activeWatches()).toHaveLength(1));
    expect(activeWatches()[0].options).toEqual({
      accuracy: Location.Accuracy.High,
      distanceInterval: 5,
    });
    expect(LIVE_WATCH_OPTIONS).toEqual(activeWatches()[0].options);

    // A vague fix is dropped; each one you can trust glides the map there.
    moveTo(COMMON, 80);
    moveTo(COMMON, null);
    expect(mockFollowTo).not.toHaveBeenCalled();
    moveTo(TREMONT);
    expect(mockFollowTo).toHaveBeenCalledTimes(1);
    expect(mockFollowTo).toHaveBeenCalledWith('diorama-map', TREMONT.latitude, TREMONT.longitude);
    mockFollowTo.mockClear();

    // Enter Diorama keeps following: the Viewer watches, the preview under it stops.
    fireEvent.press(screen.getByRole('button', { name: 'Enter Diorama' }));
    expect(await screen.findByTestId('viewer-map')).toBeOnTheScreen();
    expect(router.getPathnameWithParams()).toBe(`/view/${HERE.id}?live=1`);
    expect(mapProps('viewer-map').showsUserLocation).toBe(true);
    await waitFor(() => expect(watches).toHaveLength(2));
    expect(watches[0].removed).toBe(true);
    expect(activeWatches()).toHaveLength(1);
    moveTo(COMMON);
    expect(mockFollowTo).toHaveBeenCalledTimes(1);
    expect(mockFollowTo).toHaveBeenCalledWith('viewer-map', COMMON.latitude, COMMON.longitude);

    // Out of the Viewer, back to the live preview, which watches again.
    exitViewer();
    expect(await screen.findByTestId('city-preview-screen')).toBeOnTheScreen();
    expect(router.getPathnameWithParams()).toBe(`/city/${HERE.id}?live=1`);
    expect(screen.getByText(FOLLOWING_NOTE)).toBeOnTheScreen();
    await waitFor(() => expect(watches).toHaveLength(3));
    expect(activeWatches()).toEqual([watches[2]]);

    // Back to the picker: nothing watches.
    act(() => testRouter.back());
    await waitFor(() => expect(activeWatches()).toHaveLength(0));
  });

  it('is a fixed place when reopened from Recent', async () => {
    access = GRANTED;
    addRecent(HERE);
    const router = renderRouter(routes, { initialUrl: '/' });

    const readAccess = jest.mocked(Location.getForegroundPermissionsAsync);
    // The picker's Current location row reads the access; nothing after it does.
    await waitFor(() => expect(readAccess).toHaveBeenCalled());
    const reads = readAccess.mock.calls.length;

    fireEvent.press(await screen.findByText(HERE.name));

    expect(await screen.findByTestId('city-preview-screen')).toBeOnTheScreen();
    expect(router.getPathnameWithParams()).toBe(`/city/${HERE.id}`);
    expect(screen.queryByText(FOLLOWING_NOTE)).toBeNull();
    expect(mapProps('diorama-map').showsUserLocation).toBe(false);

    fireEvent.press(screen.getByRole('button', { name: 'Enter Diorama' }));
    expect(await screen.findByTestId('viewer-map')).toBeOnTheScreen();
    expect(router.getPathnameWithParams()).toBe(`/view/${HERE.id}`);
    expect(mapProps('viewer-map').showsUserLocation).toBe(false);
    expect(Location.watchPositionAsync).not.toHaveBeenCalled();
    // Nor does it read location access: a fixed place has no use for it.
    expect(readAccess).toHaveBeenCalledTimes(reads);
  });

  it('stops watching while the app is inactive or in the background, and starts again on return', async () => {
    access = GRANTED;
    addRecent(HERE);
    renderRouter(routes, { initialUrl: `/city/${HERE.id}?live=1` });
    expect(await screen.findByTestId('city-preview-screen')).toBeOnTheScreen();
    await waitFor(() => expect(activeWatches()).toHaveLength(1));

    setAppState('inactive');
    expect(activeWatches()).toHaveLength(0);
    setAppState('background');
    expect(activeWatches()).toHaveLength(0);
    moveTo(COMMON);
    expect(mockFollowTo).not.toHaveBeenCalled();

    setAppState('active');
    await waitFor(() => expect(activeWatches()).toHaveLength(1));
    expect(watches).toHaveLength(2);
    moveTo(COMMON);
    expect(mockFollowTo).toHaveBeenCalledWith('diorama-map', COMMON.latitude, COMMON.longitude);
  });

  it('stops watching in the Viewer while the app is in the background', async () => {
    access = GRANTED;
    addRecent(HERE);
    renderRouter(routes, { initialUrl: `/view/${HERE.id}?live=1` });
    expect(await screen.findByTestId('viewer-map')).toBeOnTheScreen();
    await waitFor(() => expect(activeWatches()).toHaveLength(1));

    setAppState('background');
    expect(activeWatches()).toHaveLength(0);
    setAppState('active');
    await waitFor(() => expect(activeWatches()).toHaveLength(1));
  });

  it('stays on the fixed place, quietly, with location access turned off', async () => {
    access = DENIED;
    addRecent(HERE);
    renderRouter(routes, { initialUrl: `/city/${HERE.id}?live=1` });
    expect(await screen.findByTestId('city-preview-screen')).toBeOnTheScreen();
    await waitFor(() => expect(Location.getForegroundPermissionsAsync).toHaveBeenCalled());

    expect(screen.queryByText(FOLLOWING_NOTE)).toBeNull();
    expect(mapProps('diorama-map').showsUserLocation).toBe(false);
    expect(Location.watchPositionAsync).not.toHaveBeenCalled();
    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it('stays put, quietly, when the watch cannot start', async () => {
    access = GRANTED;
    addRecent(HERE);
    jest.mocked(Location.watchPositionAsync).mockRejectedValue(new Error('Not authorized'));
    renderRouter(routes, { initialUrl: `/city/${HERE.id}?live=1` });
    expect(await screen.findByTestId('city-preview-screen')).toBeOnTheScreen();

    await waitFor(() => expect(Location.watchPositionAsync).toHaveBeenCalled());
    expect(mockFollowTo).not.toHaveBeenCalled();
  });
});
