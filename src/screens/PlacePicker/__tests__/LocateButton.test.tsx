import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { act, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';
import { SymbolView } from 'expo-symbols';
import { AccessibilityInfo, Linking } from 'react-native';
import type { ReactTestInstance } from 'react-test-renderer';

import type { Coordinate, PlacePickerMapViewProps, PlacePickerRegion } from '@diorama/native';
import { clearLastPickedSpot } from '@/features/location/lastPickedSpotStore';
import { queryClient } from '@/providers/queryClient';

import * as CityRoute from '../../../../app/city/[cityId]';
import * as IndexRoute from '../../../../app/index';
import * as PickRoute from '../../../../app/pick';
import * as RootLayout from '../../../../app/_layout';
import * as SettingsRoute from '../../../../app/settings';
import * as ViewRoute from '../../../../app/view/[cityId]';
import * as ViewpointsRoute from '../../../../app/viewpoints/[cityId]';
import { NEARBY_SPAN_M, START_LOCATE_TIMEOUT_MS } from '../pickerStart';

/** The native map's `moveTo`, reached through the ref as on the phone. */
const mockMoveTo = jest.fn<Promise<void>, [Coordinate, number]>(async () => {});

// The native picker map becomes a plain view that keeps its props (tests
// play MapKit's part by calling `onRegionChangeEnd`) and hands its ref a
// mock `moveTo`.
jest.mock('@diorama/native', () => {
  const { createElement, useImperativeHandle } =
    jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    ...jest.requireActual<object>('@diorama/native'),
    PlacePickerMapView: ({ ref, ...props }: { ref?: import('react').Ref<object> }) => {
      useImperativeHandle(ref, () => ({ moveTo: mockMoveTo }));
      return createElement(View, { testID: 'place-picker-map', ...props });
    },
  };
});

jest.mock('expo-haptics', () => ({
  ...jest.requireActual<object>('expo-haptics'),
  selectionAsync: jest.fn(() => Promise.resolve()),
}));

const mockSelection = jest.mocked(Haptics.selectionAsync);
const mockServices = jest.mocked(Location.hasServicesEnabledAsync);
const mockGetPermission = jest.mocked(Location.getForegroundPermissionsAsync);
const mockRequestPermission = jest.mocked(Location.requestForegroundPermissionsAsync);
const mockCurrentPosition = jest.mocked(Location.getCurrentPositionAsync);

// Every route the root layout names, so it has nothing to warn about.
const routes = {
  _layout: RootLayout,
  index: IndexRoute,
  pick: PickRoute,
  'city/[cityId]': CityRoute,
  'view/[cityId]': ViewRoute,
  'viewpoints/[cityId]': ViewpointsRoute,
  settings: SettingsRoute,
};

const { GRANTED, DENIED, UNDETERMINED } = Location.PermissionStatus;

function permission(status: Location.PermissionStatus): Location.LocationPermissionResponse {
  return { status, granted: status === GRANTED, canAskAgain: status !== DENIED, expires: 'never' };
}

/** Where the Simulator is set to be (`xcrun simctl location booted set`). */
const APPLE_PARK: Coordinate = { latitude: 37.3349, longitude: -122.009 };

const APPLE_PARK_FIX: Location.LocationObject = {
  coords: {
    ...APPLE_PARK,
    accuracy: 5,
    altitude: null,
    altitudeAccuracy: null,
    heading: null,
    speed: null,
  },
  timestamp: 0,
};

const EIFFEL: PlacePickerRegion = { latitude: 48.8584, longitude: 2.2945, spanMeters: 2000 };

/** The Eiffel Tower, 2 km across: closer than a neighborhood. */
const PICK_EIFFEL = '/pick?lat=48.8584&lon=2.2945&span=2000';
/** Dubai, 24 km across: farther out than a neighborhood. */
const PICK_DUBAI = '/pick?lat=25.1972&lon=55.2744&span=24000';

/** A promise the test settles by hand, to hold an answer "in flight". */
function deferred<T>() {
  let settle: (value: T) => void = () => {};
  const promise = new Promise<T>((resolvePromise) => {
    settle = resolvePromise;
  });
  return { promise, settle };
}

function mapProps(): PlacePickerMapViewProps {
  const map: ReactTestInstance = screen.getByTestId('place-picker-map');
  return map.props as PlacePickerMapViewProps;
}

/** What MapKit reports when the map comes to rest under the pin. */
function moveMapTo(region: PlacePickerRegion) {
  act(() => mapProps().onRegionChangeEnd?.(region));
}

function locateButton(): ReactTestInstance {
  return screen.getByRole('button', { name: 'Show my location' });
}

/** The button's arrow: `location`, or `location.fill` while the pin is on you. */
function arrow(): string {
  return String(locateButton().findByType(SymbolView).props.name);
}

let lastKnown: jest.SpyInstance<Promise<Location.LocationObject | null>>;
let openSettings: jest.SpyInstance<Promise<void>>;
let announce: jest.SpyInstance<void, [string]>;

beforeEach(() => {
  queryClient.clear();
  clearLastPickedSpot();
  mockMoveTo.mockClear();
  mockSelection.mockClear();
  mockServices.mockReset().mockResolvedValue(true);
  mockGetPermission.mockReset().mockResolvedValue(permission(UNDETERMINED));
  mockRequestPermission.mockReset().mockImplementation(async () => {
    // As iOS does: once answered, reading the access says the answer.
    mockGetPermission.mockResolvedValue(permission(DENIED));
    return permission(DENIED);
  });
  mockCurrentPosition.mockReset().mockRejectedValue(new Error('No location in Jest.'));
  lastKnown = jest.spyOn(Location, 'getLastKnownPositionAsync').mockResolvedValue(APPLE_PARK_FIX);
  openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
  announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
});

afterEach(() => {
  jest.useRealTimers();
  lastKnown.mockRestore();
  openSettings.mockRestore();
  announce.mockRestore();
});

describe('show my location', () => {
  it('is its own button beside the map, with a hollow arrow until it finds you', async () => {
    renderRouter(routes, { initialUrl: PICK_EIFFEL });
    await screen.findByTestId('place-picker-map');

    expect(locateButton()).toBeOnTheScreen();
    expect(arrow()).toBe('location');
    // The map is one element to VoiceOver; the button must not hide inside it.
    expect(
      within(screen.getByLabelText('Map')).queryByRole('button', { name: 'Show my location' }),
    ).toBeNull();
    // Opening the sheet never asks.
    expect(mockRequestPermission).not.toHaveBeenCalled();
  });

  it('glides to you with access on, zooming in to a neighborhood from farther out', async () => {
    mockGetPermission.mockResolvedValue(permission(GRANTED));
    renderRouter(routes, { initialUrl: PICK_DUBAI });
    await screen.findByTestId('place-picker-map');

    fireEvent.press(locateButton());

    await waitFor(() => expect(mockMoveTo).toHaveBeenCalledWith(APPLE_PARK, NEARBY_SPAN_M));
    expect(mockMoveTo).toHaveBeenCalledTimes(1);
    expect(mockSelection).toHaveBeenCalledTimes(1);
    expect(mockRequestPermission).not.toHaveBeenCalled();
    expect(arrow()).toBe('location.fill');

    // MapKit comes to rest a few meters off: still on you.
    moveMapTo({ latitude: 37.33505, longitude: -122.009, spanMeters: NEARBY_SPAN_M });
    expect(arrow()).toBe('location.fill');

    // Panned away: hollow again.
    moveMapTo({ latitude: 37.3352, longitude: -122.009, spanMeters: NEARBY_SPAN_M });
    expect(arrow()).toBe('location');
  });

  it('keeps a closer zoom, and moves again after the map was panned away', async () => {
    mockGetPermission.mockResolvedValue(permission(GRANTED));
    renderRouter(routes, { initialUrl: PICK_EIFFEL });
    await screen.findByTestId('place-picker-map');

    fireEvent.press(locateButton());
    await waitFor(() => expect(mockMoveTo).toHaveBeenCalledWith(APPLE_PARK, EIFFEL.spanMeters));
    moveMapTo({ ...APPLE_PARK, spanMeters: EIFFEL.spanMeters });

    // Pinched in and panned away (the `center` prop alone wouldn't move it back).
    moveMapTo({ latitude: 37.34, longitude: -122.02, spanMeters: 600 });
    expect(arrow()).toBe('location');
    fireEvent.press(locateButton());

    await waitFor(() => expect(mockMoveTo).toHaveBeenLastCalledWith(APPLE_PARK, 600));
    expect(mockMoveTo).toHaveBeenCalledTimes(2);
    expect(arrow()).toBe('location.fill');
  });

  it('asks once when access was never asked, then moves and shows the blue dot', async () => {
    mockRequestPermission.mockImplementation(async () => {
      mockGetPermission.mockResolvedValue(permission(GRANTED));
      return permission(GRANTED);
    });
    renderRouter(routes, { initialUrl: PICK_DUBAI });
    await screen.findByTestId('place-picker-map');
    expect(mapProps().showsUserLocation).toBe(false);

    fireEvent.press(locateButton());

    await waitFor(() => expect(mockMoveTo).toHaveBeenCalledWith(APPLE_PARK, NEARBY_SPAN_M));
    expect(mockRequestPermission).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(mapProps().showsUserLocation).toBe(true));
    expect(openSettings).not.toHaveBeenCalled();
  });

  it('stays put after "Don’t Allow", and only the next tap opens Settings', async () => {
    renderRouter(routes, { initialUrl: PICK_EIFFEL });
    await screen.findByTestId('place-picker-map');

    fireEvent.press(locateButton());

    await waitFor(() => expect(mockRequestPermission).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(locateButton().props.accessibilityHint).toBe('Opens Settings.'));
    expect(openSettings).not.toHaveBeenCalled();
    expect(lastKnown).not.toHaveBeenCalled();

    fireEvent.press(locateButton());

    expect(openSettings).toHaveBeenCalledTimes(1);
    expect(mockRequestPermission).toHaveBeenCalledTimes(1);
    expect(mockMoveTo).not.toHaveBeenCalled();
  });

  it.each([
    ['access is off for Diorama', () => mockGetPermission.mockResolvedValue(permission(DENIED))],
    ['Location Services is off', () => mockServices.mockResolvedValue(false)],
  ])('opens Settings without asking or moving when %s', async (_, turnOff) => {
    turnOff();
    renderRouter(routes, { initialUrl: PICK_EIFFEL });
    await screen.findByTestId('place-picker-map');
    await waitFor(() => expect(locateButton().props.accessibilityHint).toBe('Opens Settings.'));

    fireEvent.press(locateButton());

    expect(openSettings).toHaveBeenCalledTimes(1);
    expect(mockRequestPermission).not.toHaveBeenCalled();
    expect(lastKnown).not.toHaveBeenCalled();
    expect(mockMoveTo).not.toHaveBeenCalled();
    expect(mockSelection).not.toHaveBeenCalled();
  });

  it('opens Settings when access turns out to be off as it looks', async () => {
    renderRouter(routes, { initialUrl: PICK_EIFFEL });
    await screen.findByTestId('place-picker-map');
    // Turned off in Settings since the sheet read it.
    mockGetPermission.mockResolvedValue(permission(DENIED));

    fireEvent.press(locateButton());

    await waitFor(() => expect(openSettings).toHaveBeenCalledTimes(1));
    expect(mockRequestPermission).not.toHaveBeenCalled();
    expect(mockMoveTo).not.toHaveBeenCalled();
  });

  it('leaves the map alone and says so when no fix comes in time', async () => {
    mockGetPermission.mockResolvedValue(permission(GRANTED));
    lastKnown.mockResolvedValue(null);
    mockCurrentPosition.mockReturnValue(new Promise(() => {}));
    renderRouter(routes, { initialUrl: PICK_EIFFEL });
    await screen.findByTestId('place-picker-map');
    jest.useFakeTimers();

    fireEvent.press(locateButton());
    await waitFor(() => expect(mockCurrentPosition).toHaveBeenCalled());
    expect(announce).not.toHaveBeenCalled();
    await act(() => jest.advanceTimersByTimeAsync(START_LOCATE_TIMEOUT_MS));

    await waitFor(() => expect(announce).toHaveBeenCalledWith("Can't find your location"));
    expect(mockMoveTo).not.toHaveBeenCalled();
    expect(arrow()).toBe('location');
  });

  it('ignores taps while it looks', async () => {
    mockGetPermission.mockResolvedValue(permission(GRANTED));
    const fix = deferred<Location.LocationObject | null>();
    lastKnown.mockReturnValue(fix.promise);
    renderRouter(routes, { initialUrl: PICK_EIFFEL });
    await screen.findByTestId('place-picker-map');

    fireEvent.press(locateButton());
    await waitFor(() => expect(lastKnown).toHaveBeenCalledTimes(1));
    fireEvent.press(locateButton());
    fireEvent.press(locateButton());
    await act(async () => fix.settle(APPLE_PARK_FIX));

    await waitFor(() => expect(mockMoveTo).toHaveBeenCalledTimes(1));
    expect(lastKnown).toHaveBeenCalledTimes(1);
    expect(mockSelection).toHaveBeenCalledTimes(1);
  });
});
