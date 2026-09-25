import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { router as appRouter } from 'expo-router';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import type { ReactTestInstance } from 'react-test-renderer';

import type { PlacePickerMapViewProps, PlacePickerRegion } from '@diorama/native';
import { addRecent, clearRecents, getRecents } from '@/features/cities/recentsStore';
import { queryClient } from '@/providers/queryClient';
import { TERRAIN_NOTE } from '@/screens/CityPreview/TerrainNote';

import * as CityRoute from '../../../../app/city/[cityId]';
import * as IndexRoute from '../../../../app/index';
import * as PickRoute from '../../../../app/pick';
import * as RootLayout from '../../../../app/_layout';
import * as SettingsRoute from '../../../../app/settings';
import * as ViewerRoute from '../../../../app/view/[cityId]';
import { BUILDINGS_NOTE } from '../CoverageNote';
import { spotNameKey } from '../spotName';

// Both native maps become plain views that keep their props, so tests can
// read them and play MapKit's part by calling `onRegionChangeEnd`.
jest.mock('@diorama/native', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    ...jest.requireActual<object>('@diorama/native'),
    PlacePickerMapView: (props: object) =>
      createElement(View, { testID: 'place-picker-map', ...props }),
    DioramaMapView: (props: object) => createElement(View, { testID: 'diorama-map', ...props }),
  };
});

jest.mock('expo-haptics', () => ({
  ...jest.requireActual<object>('expo-haptics'),
  impactAsync: jest.fn(() => Promise.resolve()),
}));

const mockImpact = jest.mocked(Haptics.impactAsync);
const mockGetPermission = jest.mocked(Location.getForegroundPermissionsAsync);
const mockReverseGeocode = jest.mocked(Location.reverseGeocodeAsync);

const routes = {
  _layout: RootLayout,
  index: IndexRoute,
  pick: PickRoute,
  'city/[cityId]': CityRoute,
  'view/[cityId]': ViewerRoute,
  settings: SettingsRoute,
};

const { GRANTED, UNDETERMINED } = Location.PermissionStatus;

function permission(status: Location.PermissionStatus): Location.LocationPermissionResponse {
  return { status, granted: status === GRANTED, canAskAgain: true, expires: 'never' };
}

function address(fields: Partial<Location.LocationGeocodedAddress>) {
  return {
    city: null,
    district: null,
    streetNumber: null,
    street: null,
    region: null,
    subregion: null,
    country: null,
    postalCode: null,
    name: null,
    isoCountryCode: null,
    timezone: null,
    formattedAddress: null,
    ...fields,
  } satisfies Location.LocationGeocodedAddress;
}

// Three spots, one per kind of 3D coverage (see flyoverCoverage.ts).
const EIFFEL: PlacePickerRegion = { latitude: 48.8584, longitude: 2.2945, spanMeters: 2000 };
const BURJ: PlacePickerRegion = { latitude: 25.1972, longitude: 55.2744, spanMeters: 24_000 };
const REYKJAVIK: PlacePickerRegion = { latitude: 64.1466, longitude: -21.9426, spanMeters: 3000 };

const EIFFEL_ADDRESS = address({ name: 'Eiffel Tower', city: 'Paris', country: 'France' });
const BURJ_ADDRESS = address({
  name: '1 Sheikh Mohammed bin Rashid Blvd',
  city: 'Dubai',
  country: 'United Arab Emirates',
});
const HARPA_ADDRESS = address({ name: 'Harpa', city: 'Reykjavík', country: 'Iceland' });

const ADDRESSES = new Map([
  [EIFFEL.latitude, EIFFEL_ADDRESS],
  [BURJ.latitude, BURJ_ADDRESS],
  [REYKJAVIK.latitude, HARPA_ADDRESS],
]);

const PICK_EIFFEL = '/pick?lat=48.8584&lon=2.2945&span=2000';

/** The picker map's props. */
function mapProps(): PlacePickerMapViewProps {
  const map: ReactTestInstance = screen.getByTestId('place-picker-map');
  return map.props as PlacePickerMapViewProps;
}

/** What MapKit reports when the map comes to rest under the pin. */
function moveMapTo(region: PlacePickerRegion) {
  act(() => mapProps().onRegionChangeEnd?.(region));
}

/** A promise the test settles by hand, to hold an answer "in flight". */
function deferred<T>() {
  let settle: (value: T) => void = () => {};
  const promise = new Promise<T>((resolvePromise) => {
    settle = resolvePromise;
  });
  return { promise, settle };
}

beforeEach(() => {
  queryClient.clear();
  clearRecents();
  mockImpact.mockClear();
  mockGetPermission.mockReset().mockResolvedValue(permission(UNDETERMINED));
  mockReverseGeocode.mockReset().mockImplementation(async ({ latitude }) => {
    const found = ADDRESSES.get(latitude);
    return found ? [found] : [];
  });
});

describe('choose on map', () => {
  it('opens on a linked spot, with the pin, its name and its 3D coverage', async () => {
    renderRouter(routes, { initialUrl: PICK_EIFFEL });

    expect(await screen.findByTestId('place-picker-screen')).toBeOnTheScreen();
    expect(mapProps()).toMatchObject({
      center: { latitude: 48.8584, longitude: 2.2945 },
      span: 2000,
      showsUserLocation: false,
    });
    expect(await screen.findByText('Eiffel Tower')).toBeOnTheScreen();
    expect(screen.getByText('Paris, France')).toBeOnTheScreen();
    expect(screen.getByText(BUILDINGS_NOTE)).toBeOnTheScreen();
    expect(screen.getByLabelText('Map').props.accessibilityHint).toBe('Drag to move the pin.');
    expect(screen.getByRole('button', { name: 'Open diorama' })).toBeOnTheScreen();
  });

  it('names the spot under the pin after the map moves, with its coverage', async () => {
    renderRouter(routes, { initialUrl: PICK_EIFFEL });
    await screen.findByText('Eiffel Tower');

    moveMapTo(BURJ);
    // Coordinates until the name comes, never the old spot's name.
    expect(screen.getByText('25.1972° N, 55.2744° E')).toBeOnTheScreen();
    expect(screen.queryByText('Eiffel Tower')).toBeNull();
    expect(await screen.findByText('1 Sheikh Mohammed bin Rashid Blvd')).toBeOnTheScreen();
    expect(screen.getByText('Dubai, United Arab Emirates')).toBeOnTheScreen();
    expect(screen.getByText(TERRAIN_NOTE)).toBeOnTheScreen();

    // Nobody has checked here: nothing said about 3D.
    moveMapTo(REYKJAVIK);
    expect(await screen.findByText('Harpa')).toBeOnTheScreen();
    expect(screen.queryByTestId('coverage-note')).toBeNull();
  });

  it('asks Apple Maps once the map has rested, not once per pan', async () => {
    renderRouter(routes, { initialUrl: PICK_EIFFEL });
    await screen.findByText('Eiffel Tower');
    mockReverseGeocode.mockClear();

    moveMapTo(REYKJAVIK);
    moveMapTo(BURJ);
    expect(await screen.findByText('1 Sheikh Mohammed bin Rashid Blvd')).toBeOnTheScreen();
    expect(mockReverseGeocode.mock.calls).toEqual([
      [{ latitude: BURJ.latitude, longitude: BURJ.longitude }],
    ]);
  });

  it('falls back to the coordinates where Apple Maps has no name', async () => {
    renderRouter(routes, { initialUrl: '/pick?lat=-40.5&lon=-120.25' });

    await waitFor(() => expect(mockReverseGeocode).toHaveBeenCalled());
    expect(screen.getByText('40.5000° S, 120.2500° W')).toBeOnTheScreen();
    // No span in the link: a neighborhood.
    expect(mapProps().span).toBe(3000);
  });

  it('never lets a late answer for an old spot replace the new spot’s name', async () => {
    const burjAnswer = deferred<Location.LocationGeocodedAddress[]>();
    const reykjavikAnswer = deferred<Location.LocationGeocodedAddress[]>();
    renderRouter(routes, { initialUrl: PICK_EIFFEL });
    await screen.findByText('Eiffel Tower');
    mockReverseGeocode.mockImplementation(({ latitude }) =>
      latitude === BURJ.latitude ? burjAnswer.promise : reykjavikAnswer.promise,
    );

    moveMapTo(BURJ);
    await waitFor(() => expect(mockReverseGeocode).toHaveBeenCalledTimes(2));
    moveMapTo(REYKJAVIK);
    await waitFor(() => expect(mockReverseGeocode).toHaveBeenCalledTimes(3));

    // The old spot's answer lands first: the card still names the new spot by its coordinates.
    await act(async () => burjAnswer.settle([BURJ_ADDRESS]));
    await waitFor(() => expect(queryClient.getQueryData(spotNameKey(BURJ))).toEqual(BURJ_ADDRESS));
    expect(screen.queryByText('1 Sheikh Mohammed bin Rashid Blvd')).toBeNull();
    expect(screen.getByText('64.1466° N, 21.9426° W')).toBeOnTheScreen();

    await act(async () => reykjavikAnswer.settle([HARPA_ADDRESS]));
    expect(await screen.findByText('Harpa')).toBeOnTheScreen();
    expect(screen.queryByText('1 Sheikh Mohammed bin Rashid Blvd')).toBeNull();
  });

  it('opens the diorama there: into Recent at the span’s altitude, sheet closed, preview open', async () => {
    const router = renderRouter(routes, { initialUrl: PICK_EIFFEL });
    await screen.findByText('Eiffel Tower');

    // 24 km across → a camera 2 km out (a twelfth of the width).
    moveMapTo(BURJ);
    await screen.findByText('1 Sheikh Mohammed bin Rashid Blvd');
    fireEvent.press(screen.getByRole('button', { name: 'Open diorama' }));

    const id = '1-sheikh-mohammed-bin-rashid-blvd_25.197_55.274';
    await waitFor(() => expect(router.getPathname()).toBe(`/city/${id}`));
    expect(getRecents()[0]).toEqual({
      id,
      name: '1 Sheikh Mohammed bin Rashid Blvd',
      country: 'Dubai, United Arab Emirates',
      lat: 25.1972,
      lon: 55.2744,
      altitude: 2000,
    });
    expect(await screen.findByTestId('city-preview-screen')).toBeOnTheScreen();
    expect(screen.queryByTestId('place-picker-screen')).toBeNull();
    expect(mockImpact).toHaveBeenCalledTimes(1);
    // The sheet is gone: back from the preview goes to the picker, not the map.
    expect(router.getRouterState()?.routes[0]?.state?.routes.map(({ name }) => name)).toEqual([
      'index',
      'city/[cityId]',
    ]);
  });

  it('keeps the camera between 600 m and 4.5 km out, however far the map is zoomed', async () => {
    const router = renderRouter(routes, { initialUrl: PICK_EIFFEL });
    await screen.findByText('Eiffel Tower');

    // 2 km across would be 167 m out: too close to read as a model.
    fireEvent.press(screen.getByRole('button', { name: 'Open diorama' }));
    await waitFor(() => expect(router.getPathname()).toMatch(/^\/city\/eiffel-tower_/));
    expect(getRecents()[0]).toMatchObject({ name: 'Eiffel Tower', altitude: 600 });
  });

  it('starts at the newest place in Recent, framed as its diorama is', async () => {
    addRecent({
      id: 'rome',
      name: 'Rome',
      country: 'Italy',
      lat: 41.9,
      lon: 12.5,
      altitude: 1500,
    });
    renderRouter(routes, { initialUrl: '/pick' });

    await screen.findByTestId('place-picker-map');
    expect(mapProps()).toMatchObject({ center: { latitude: 41.9, longitude: 12.5 }, span: 18_000 });
    expect(mockGetPermission).toHaveBeenCalled();
  });

  it('starts in New York with nothing in Recent and no location access', async () => {
    renderRouter(routes, { initialUrl: '/pick' });

    await screen.findByTestId('place-picker-map');
    expect(mapProps()).toMatchObject({
      center: { latitude: 40.7549, longitude: -73.984 },
      showsUserLocation: false,
    });
    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it('starts where you are, with the blue dot, when location access is on', async () => {
    mockGetPermission.mockResolvedValue(permission(GRANTED));
    const lastKnown = jest.spyOn(Location, 'getLastKnownPositionAsync').mockResolvedValue({
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
    });
    renderRouter(routes, { initialUrl: '/pick' });

    await screen.findByTestId('place-picker-map');
    expect(mapProps()).toMatchObject({
      center: { latitude: 42.3601, longitude: -71.0589 },
      span: 3000,
    });
    await waitFor(() => expect(mapProps().showsUserLocation).toBe(true));
    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    lastKnown.mockRestore();
  });

  it('moves the open sheet’s map for a second link, rather than stacking another sheet', async () => {
    renderRouter(routes, { initialUrl: PICK_EIFFEL });
    await screen.findByText('Eiffel Tower');

    act(() => appRouter.push('/pick?lat=25.1972&lon=55.2744&span=24000'));

    await waitFor(() =>
      expect(mapProps()).toMatchObject({
        center: { latitude: 25.1972, longitude: 55.2744 },
        span: 24_000,
      }),
    );
    // Counting screens covered by others too.
    expect(
      screen.getAllByTestId('place-picker-screen', { includeHiddenElements: true }),
    ).toHaveLength(1);
  });

  it('closes with the ✕, leaving Recent alone', async () => {
    const router = renderRouter(routes, { initialUrl: PICK_EIFFEL });
    await screen.findByText('Eiffel Tower');

    fireEvent.press(screen.getByRole('button', { name: 'Close' }));

    await waitFor(() => expect(router.getPathname()).toBe('/'));
    expect(getRecents()).toEqual([]);
  });
});
