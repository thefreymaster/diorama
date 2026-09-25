import * as Haptics from 'expo-haptics';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Platform } from 'react-native';

import {
  PLACE_ALTITUDES,
  placeId,
  pointsOfInterest,
  type PointOfInterest,
  type PointOfInterestCategory,
} from '@diorama/native';
import {
  addRecent,
  clearRecents,
  getRecents,
  type RecentCity,
} from '@/features/cities/recentsStore';
import { resetSettings } from '@/features/settings/store';
import { queryClient } from '@/providers/queryClient';

import * as CityRoute from '../../../../app/city/[cityId]';
import * as IndexRoute from '../../../../app/index';
import * as RootLayout from '../../../../app/_layout';
import * as SettingsRoute from '../../../../app/settings';
import * as ViewerRoute from '../../../../app/view/[cityId]';
import * as ViewpointsRoute from '../../../../app/viewpoints/[cityId]';

// The native map becomes a plain view, and Apple Maps' points of interest
// are whatever each test answers.
jest.mock('@diorama/native', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    ...jest.requireActual<object>('@diorama/native'),
    DioramaMapView: (props: object) => createElement(View, { testID: 'diorama-map', ...props }),
    pointsOfInterest: jest.fn(),
  };
});

jest.mock('expo-haptics', () => ({
  ...jest.requireActual<object>('expo-haptics'),
  selectionAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
}));

const mockPointsOfInterest = jest.mocked(pointsOfInterest);
const mockSelectionHaptic = jest.mocked(Haptics.selectionAsync);

const routes = {
  _layout: RootLayout,
  index: IndexRoute,
  'city/[cityId]': CityRoute,
  'viewpoints/[cityId]': ViewpointsRoute,
  'view/[cityId]': ViewerRoute,
  settings: SettingsRoute,
};

function point(
  name: string,
  latitude: number,
  longitude: number,
  category: PointOfInterestCategory,
): PointOfInterest {
  return { id: placeId(name, latitude, longitude), name, latitude, longitude, category };
}

// Apple's answers around the South Rim (iOS 27, trimmed), in Apple's order.
const MATHER = point('Mather Point', 36.06167, -112.10779, 'scenicView');
const SCENIC_VIEWS = [
  point('Grandview Point', 35.99847, -111.98772, 'scenicView'),
  MATHER,
  point('Yavapai Point', 36.06613, -112.11708, 'scenicView'),
];
const VISITOR_CENTERS = [
  point('South Rim Visitor Center', 36.05914, -112.10933, 'visitorCenter'),
  point('Mather Point', 36.06101, -112.10781, 'visitorCenter'),
];

// A landmark found by search (T25 kind 'place') and a street address.
const HALF_DOME: RecentCity = {
  id: 'half-dome_37.746_-119.533',
  name: 'Half Dome',
  country: 'Yosemite Valley, United States',
  lat: 37.7459,
  lon: -119.5332,
  altitude: PLACE_ALTITUDES.place,
};
const INFINITE_LOOP: RecentCity = {
  id: '1-infinite-loop_37.332_-122.030',
  name: '1 Infinite Loop',
  country: 'Cupertino, United States',
  lat: 37.331656,
  lon: -122.030143,
  altitude: PLACE_ALTITUDES.address,
};

/** Apple Maps' answer for each kind. */
function answer(byKind: Partial<Record<PointOfInterestCategory, PointOfInterest[]>>) {
  mockPointsOfInterest.mockImplementation(async (_lat, _lon, _radius, [category]) =>
    category ? (byKind[category] ?? []) : [],
  );
}

/** A promise the test settles by hand, to hold Apple's answer "in flight". */
function deferred<T>() {
  let settle: (value: T) => void = () => {};
  const promise = new Promise<T>((resolvePromise) => {
    settle = resolvePromise;
  });
  return { promise, settle };
}

function onIOS(version: string) {
  jest.spyOn(Platform, 'Version', 'get').mockReturnValue(version);
}

const ROW_NAME = /^Viewpoints, \d+ nearby$/;

beforeEach(() => {
  queryClient.clear();
  clearRecents();
  resetSettings();
  mockPointsOfInterest.mockReset();
  mockSelectionHaptic.mockClear();
  onIOS('27.0');
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('viewpoints', () => {
  it("offers a national park's viewpoints on its card, in a sheet listing them", async () => {
    answer({ scenicView: SCENIC_VIEWS, visitorCenter: VISITOR_CENTERS });
    const router = renderRouter(routes, { initialUrl: '/city/grand-canyon' });

    const row = await screen.findByRole('button', { name: 'Viewpoints, 4 nearby' });
    fireEvent.press(row);

    expect(await screen.findByTestId('viewpoints-screen')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/viewpoints/grand-canyon');
    expect(mockSelectionHaptic).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('header', { name: 'Viewpoints' })).toBeOnTheScreen();
    // Scenic views first, then visitor centers, each nearest first; Mather
    // Point once, as a scenic view. Each with its kind and distance.
    const titles = screen
      .getAllByText(/^(Mather Point|Yavapai Point|Grandview Point|South Rim Visitor Center)$/)
      .map((title) => title.props.children as string);
    expect(titles).toEqual([
      'Mather Point',
      'Yavapai Point',
      'Grandview Point',
      'South Rim Visitor Center',
    ]);
    expect(screen.getAllByText('Scenic view')).toHaveLength(3);
    expect(screen.getAllByText('Visitor center')).toHaveLength(1);
    expect(screen.getByText('Distances from the center of Grand Canyon.')).toBeOnTheScreen();
    // Grandview Point, 12.9 km out, in the test machine's units.
    expect(screen.getByText(/^(8 mi|13 km)$/)).toBeOnTheScreen();
    // Asked once for the card; the sheet reused the answer.
    expect(mockPointsOfInterest).toHaveBeenCalledTimes(2);
  });

  it('opens a tapped viewpoint as a place: the sheet closes, it joins Recent, its preview opens', async () => {
    answer({ scenicView: SCENIC_VIEWS, visitorCenter: VISITOR_CENTERS });
    const router = renderRouter(routes, { initialUrl: '/city/grand-canyon' });
    fireEvent.press(await screen.findByRole('button', { name: ROW_NAME }));
    await screen.findByTestId('viewpoints-screen');
    mockSelectionHaptic.mockClear();

    fireEvent.press(screen.getByRole('button', { name: /^Mather Point/ }));

    await waitFor(() => expect(router.getPathname()).toBe(`/city/${MATHER.id}`));
    expect(screen.queryByTestId('viewpoints-screen')).toBeNull();
    expect(getRecents()[0]).toEqual({
      id: 'mather-point_36.062_-112.108',
      name: 'Mather Point',
      country: 'Grand Canyon',
      lat: 36.06167,
      lon: -112.10779,
      altitude: 1200,
    });
    expect(await screen.findByRole('header', { name: 'Mather Point' })).toBeOnTheScreen();
    expect(mockSelectionHaptic).toHaveBeenCalledTimes(1);
  });

  it('opens a visitor center a little closer than a scenic view', async () => {
    answer({ scenicView: SCENIC_VIEWS, visitorCenter: VISITOR_CENTERS });
    renderRouter(routes, { initialUrl: '/city/grand-canyon' });
    fireEvent.press(await screen.findByRole('button', { name: ROW_NAME }));
    await screen.findByTestId('viewpoints-screen');

    fireEvent.press(screen.getByRole('button', { name: /^South Rim Visitor Center/ }));

    await waitFor(() => expect(getRecents()[0]?.name).toBe('South Rim Visitor Center'));
    expect(getRecents()[0]?.altitude).toBe(900);
  });

  it('opens the viewpoint a link names, as if tapped', async () => {
    answer({ scenicView: SCENIC_VIEWS });
    const router = renderRouter(routes, {
      initialUrl: `/viewpoints/grand-canyon?open=${MATHER.id}`,
    });

    await waitFor(() => expect(router.getPathname()).toBe(`/city/${MATHER.id}`));
    expect(getRecents().map((place) => place.name)).toEqual(['Mather Point']);
  });

  it('hides the row when Apple Maps finds nothing', async () => {
    answer({});
    renderRouter(routes, { initialUrl: '/city/grand-canyon' });

    await waitFor(() => expect(mockPointsOfInterest).toHaveBeenCalledTimes(2));
    await act(async () => {});
    expect(screen.queryByRole('button', { name: ROW_NAME })).toBeNull();
    expect(screen.queryByTestId('viewpoints-row')).toBeNull();
  });

  it('hides the row, and never asks, before iOS 27', async () => {
    onIOS('26.5');
    answer({ scenicView: SCENIC_VIEWS });
    renderRouter(routes, { initialUrl: '/city/grand-canyon' });

    expect(await screen.findByTestId('city-preview-screen')).toBeOnTheScreen();
    await act(async () => {});
    expect(screen.queryByRole('button', { name: ROW_NAME })).toBeNull();
    expect(mockPointsOfInterest).not.toHaveBeenCalled();
  });

  it('offers viewpoints for a searched landmark only when a scenic view turns up', async () => {
    addRecent(HALF_DOME);
    answer({ scenicView: [point('Glacier Point', 37.72842, -119.57349, 'scenicView')] });
    renderRouter(routes, { initialUrl: `/city/${HALF_DOME.id}` });

    expect(await screen.findByRole('button', { name: 'Viewpoints, 1 nearby' })).toBeOnTheScreen();
  });

  it("doesn't ask for featured cities or addresses", async () => {
    addRecent(INFINITE_LOOP);
    answer({ scenicView: SCENIC_VIEWS });
    renderRouter(routes, { initialUrl: `/city/${INFINITE_LOOP.id}` });
    expect(await screen.findByTestId('city-preview-screen')).toBeOnTheScreen();

    renderRouter(routes, { initialUrl: '/city/paris' });
    expect(await screen.findByTestId('city-preview-screen')).toBeOnTheScreen();

    await act(async () => {});
    expect(mockPointsOfInterest).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: ROW_NAME })).toBeNull();
  });

  it('shows placeholder rows while Apple Maps answers, and closes if nothing turns up', async () => {
    const pending = deferred<PointOfInterest[]>();
    mockPointsOfInterest.mockReturnValue(pending.promise);
    const router = renderRouter(routes, { initialUrl: '/viewpoints/grand-canyon' });

    expect(await screen.findByTestId('viewpoints-screen')).toBeOnTheScreen();
    expect(screen.getAllByLabelText('Loading')).toHaveLength(4);

    await act(async () => pending.settle([]));

    await waitFor(() => expect(router.getPathname()).toBe('/'));
    expect(screen.queryByTestId('viewpoints-screen')).toBeNull();
  });

  it('closes at once for a place it knows nothing about', async () => {
    const router = renderRouter(routes, { initialUrl: '/viewpoints/atlantis' });

    await waitFor(() => expect(router.getPathname()).toBe('/'));
    expect(mockPointsOfInterest).not.toHaveBeenCalled();
  });

  it('closes with its ✕', async () => {
    answer({ scenicView: SCENIC_VIEWS });
    const router = renderRouter(routes, { initialUrl: '/city/grand-canyon' });
    fireEvent.press(await screen.findByRole('button', { name: ROW_NAME }));
    await screen.findByTestId('viewpoints-screen');

    fireEvent.press(screen.getByRole('button', { name: 'Close' }));

    await waitFor(() => expect(router.getPathname()).toBe('/city/grand-canyon'));
  });
});
