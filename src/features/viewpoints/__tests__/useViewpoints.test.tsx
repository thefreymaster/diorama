import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Platform } from 'react-native';

import {
  PLACE_ALTITUDES,
  placeId,
  pointsOfInterest,
  type PointOfInterest,
  type PointOfInterestCategory,
} from '@diorama/native';
import { getCuratedCity } from '@/features/cities/curated';
import type { RecentCity } from '@/features/cities/recentsStore';

import { useViewpoints, viewpointKeys } from '../queries';

// The Swift function; everything else in the module stays real.
jest.mock('@diorama/native', () => ({
  ...jest.requireActual('@diorama/native'),
  pointsOfInterest: jest.fn(),
}));

const mockPointsOfInterest = jest.mocked(pointsOfInterest);

function point(
  name: string,
  latitude: number,
  longitude: number,
  category: PointOfInterestCategory,
): PointOfInterest {
  return { id: placeId(name, latitude, longitude), name, latitude, longitude, category };
}

const GRAND_CANYON = getCuratedCity('grand-canyon')!;
const PARIS = getCuratedCity('paris')!;

// Apple's answers around the South Rim (iOS 27, trimmed), in Apple's order.
const SCENIC_VIEWS = [
  point('Grandview Point', 35.99847, -111.98772, 'scenicView'),
  point('Mather Point', 36.06167, -112.10779, 'scenicView'),
  point('Lipan Point', 36.03296, -111.85327, 'scenicView'),
  point('Yavapai Point', 36.06613, -112.11708, 'scenicView'),
  point('Lipan Point', 36.03296, -111.85327, 'scenicView'),
];
const VISITOR_CENTERS = [
  point('North Rim Visitor Center', 36.19839, -112.05248, 'visitorCenter'),
  point('South Rim Visitor Center', 36.05914, -112.10933, 'visitorCenter'),
  point('Mather Point', 36.06101, -112.10781, 'visitorCenter'),
];

// A searched landmark (T25 kind 'place').
const HALF_DOME: RecentCity = {
  id: 'half-dome_37.746_-119.533',
  name: 'Half Dome',
  country: 'Yosemite Valley, United States',
  lat: 37.7459,
  lon: -119.5332,
  altitude: PLACE_ALTITUDES.place,
};

/** Apple Maps' answer for each kind. */
function answer(byKind: Partial<Record<PointOfInterestCategory, PointOfInterest[]>>) {
  mockPointsOfInterest.mockImplementation(async (_lat, _lon, _radius, [category]) =>
    category ? (byKind[category] ?? []) : [],
  );
}

function createWrapper() {
  // No garbage-collection timers, so Jest can exit.
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return { client, wrapper: Wrapper };
}

function onIOS(version: string) {
  jest.spyOn(Platform, 'Version', 'get').mockReturnValue(version);
}

beforeEach(() => {
  mockPointsOfInterest.mockReset();
  onIOS('27.0');
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('useViewpoints', () => {
  it('asks for scenic views, then visitor centers, and lists them in order, once each', async () => {
    answer({ scenicView: SCENIC_VIEWS, visitorCenter: VISITOR_CENTERS });
    const { client, wrapper } = createWrapper();

    const { result } = renderHook(() => useViewpoints(GRAND_CANYON), { wrapper });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.viewpoints).toEqual([]);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.viewpoints.map(({ name, category }) => [name, category])).toEqual([
      ['Mather Point', 'scenicView'],
      ['Yavapai Point', 'scenicView'],
      ['Grandview Point', 'scenicView'],
      ['Lipan Point', 'scenicView'],
      ['South Rim Visitor Center', 'visitorCenter'],
      ['North Rim Visitor Center', 'visitorCenter'],
    ]);
    expect(mockPointsOfInterest.mock.calls).toEqual([
      [GRAND_CANYON.lat, GRAND_CANYON.lon, 25_000, ['scenicView']],
      [GRAND_CANYON.lat, GRAND_CANYON.lon, 25_000, ['visitorCenter']],
    ]);
    expect(client.getQueryData(viewpointKeys.place('grand-canyon'))).toEqual(
      result.current.viewpoints,
    );
  });

  it('asks once per place: the sheet reuses what the card found', async () => {
    answer({ scenicView: SCENIC_VIEWS });
    const { wrapper } = createWrapper();
    const card = renderHook(() => useViewpoints(GRAND_CANYON), { wrapper });
    await waitFor(() => expect(card.result.current.viewpoints).toHaveLength(4));

    const sheet = renderHook(() => useViewpoints(GRAND_CANYON), { wrapper });

    expect(sheet.result.current.isLoading).toBe(false);
    expect(sheet.result.current.viewpoints).toHaveLength(4);
    expect(mockPointsOfInterest).toHaveBeenCalledTimes(2);
  });

  it('lists nothing, without asking, before iOS 27', () => {
    onIOS('26.5');
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useViewpoints(GRAND_CANYON), { wrapper });

    expect(result.current).toEqual({ viewpoints: [], isLoading: false });
    expect(mockPointsOfInterest).not.toHaveBeenCalled();
  });

  it("doesn't ask for cities, addresses or unknown places", () => {
    const { wrapper } = createWrapper();
    const address: RecentCity = { ...HALF_DOME, altitude: PLACE_ALTITUDES.address };

    for (const place of [PARIS, address, null]) {
      const { result } = renderHook(() => useViewpoints(place), { wrapper });
      expect(result.current).toEqual({ viewpoints: [], isLoading: false });
    }
    expect(mockPointsOfInterest).not.toHaveBeenCalled();
  });

  it('lists a natural place only with a scenic view, and asks no more without one', async () => {
    answer({
      visitorCenter: [
        point('Yosemite Valley Welcome Center', 37.7465, -119.58443, 'visitorCenter'),
      ],
    });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useViewpoints(HALF_DOME), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.viewpoints).toEqual([]);
    expect(mockPointsOfInterest).toHaveBeenCalledTimes(1);
    expect(mockPointsOfInterest).toHaveBeenCalledWith(37.7459, -119.5332, 6300, ['scenicView']);
  });

  it('lists a natural place with a scenic view, visitor centers too', async () => {
    answer({
      scenicView: [point('Glacier Point', 37.72842, -119.57349, 'scenicView')],
      visitorCenter: [
        point('Yosemite Valley Welcome Center', 37.7465, -119.58443, 'visitorCenter'),
      ],
    });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useViewpoints(HALF_DOME), { wrapper });
    await waitFor(() => expect(result.current.viewpoints).toHaveLength(2));

    expect(result.current.viewpoints.map((viewpoint) => viewpoint.name)).toEqual([
      'Glacier Point',
      'Yosemite Valley Welcome Center',
    ]);
  });

  it('keeps the scenic views when only the visitor centers fail', async () => {
    mockPointsOfInterest.mockImplementation(async (_lat, _lon, _radius, [category]) => {
      if (category === 'visitorCenter') throw new Error('Place search failed: throttled');
      return SCENIC_VIEWS;
    });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useViewpoints(GRAND_CANYON), { wrapper });

    await waitFor(() => expect(result.current.viewpoints).toHaveLength(4));
  });

  it('lists nothing, quietly and without retrying, when Apple Maps fails', async () => {
    mockPointsOfInterest.mockRejectedValue(new Error('Place search failed: offline'));
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useViewpoints(GRAND_CANYON), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.viewpoints).toEqual([]);
    expect(mockPointsOfInterest).toHaveBeenCalledTimes(1);
  });
});
