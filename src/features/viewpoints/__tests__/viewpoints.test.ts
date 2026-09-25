import { PLACE_ALTITUDES, placeId, type PointOfInterest } from '@diorama/native';
import { getCuratedCity } from '@/features/cities/curated';
import type { RecentCity } from '@/features/cities/recentsStore';

import {
  VIEWPOINT_ALTITUDES,
  VIEWPOINT_RADIUS,
  isNaturalPlace,
  orderViewpoints,
  viewpointPlace,
  viewpointSearch,
} from '../viewpoints';

function curated(id: string): RecentCity {
  const place = getCuratedCity(id);
  if (!place) throw new Error(`No curated place ${id}`);
  return place;
}

function point(
  name: string,
  latitude: number,
  longitude: number,
  category: PointOfInterest['category'] = 'scenicView',
): PointOfInterest {
  return { id: placeId(name, latitude, longitude), name, latitude, longitude, category };
}

const GRAND_CANYON = curated('grand-canyon');

// What Apple Maps returns around the South Rim (iOS 27, trimmed).
const YAVAPAI = point('Yavapai Point', 36.06613, -112.11708); // ~1.0 km
const MATHER = point('Mather Point', 36.06167, -112.10779); // ~0.1 km
const GRANDVIEW = point('Grandview Point', 35.99847, -111.98772); // ~12.9 km
const LIPAN = point('Lipan Point', 36.03296, -111.85327); // ~23.1 km
const VISITOR_CENTER = point('South Rim Visitor Center', 36.05914, -112.10933, 'visitorCenter');
const MATHER_AS_CENTER = point('Mather Point', 36.06101, -112.10781, 'visitorCenter');
const NORTH_RIM_CENTER = point('North Rim Visitor Center', 36.19839, -112.05248, 'visitorCenter');

// A searched landmark (T25 kind 'place') and a street address.
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

describe('viewpointSearch', () => {
  it('looks 25 km around every national park', () => {
    for (const id of ['grand-canyon', 'yosemite', 'zion', 'mount-everest']) {
      expect(viewpointSearch(curated(id))).toEqual({ radius: VIEWPOINT_RADIUS.park, isPark: true });
    }
  });

  it("doesn't ask for featured cities, addresses or searched cities", () => {
    expect(viewpointSearch(curated('paris'))).toBeNull();
    expect(viewpointSearch(INFINITE_LOOP)).toBeNull();
    expect(viewpointSearch({ ...HALF_DOME, id: 'reykjavik_64.147_-21.943', altitude: 1500 })).toBe(
      null,
    );
  });

  it('looks around a natural place as far as its framing takes in', () => {
    expect(viewpointSearch(HALF_DOME)).toEqual({ radius: 6300, isPark: false });
    const scenicView = { ...HALF_DOME, altitude: VIEWPOINT_ALTITUDES.scenicView };
    expect(viewpointSearch(scenicView)).toEqual({ radius: 8400, isPark: false });
  });
});

describe('isNaturalPlace', () => {
  it("knows a landmark or an opened viewpoint by T25's camera distance", () => {
    expect(isNaturalPlace(HALF_DOME)).toBe(true);
    expect(isNaturalPlace({ ...HALF_DOME, altitude: VIEWPOINT_ALTITUDES.scenicView })).toBe(true);
    expect(isNaturalPlace(INFINITE_LOOP)).toBe(false);
  });

  it('leaves built-in places to their category', () => {
    expect(isNaturalPlace(curated('grand-canyon'))).toBe(false);
    expect(isNaturalPlace({ ...curated('paris'), altitude: PLACE_ALTITUDES.place })).toBe(false);
  });
});

describe('orderViewpoints', () => {
  it('puts scenic views first, then the rest, each nearest first, with distances', () => {
    const list = orderViewpoints(GRAND_CANYON, [
      NORTH_RIM_CENTER,
      GRANDVIEW,
      VISITOR_CENTER,
      YAVAPAI,
      LIPAN,
      MATHER,
    ]);

    expect(list.map((viewpoint) => viewpoint.name)).toEqual([
      'Mather Point',
      'Yavapai Point',
      'Grandview Point',
      'Lipan Point',
      'South Rim Visitor Center',
      'North Rim Visitor Center',
    ]);
    expect(list[0]!.distance).toBeGreaterThan(50);
    expect(list[0]!.distance).toBeLessThan(150);
    expect(list[2]!.distance / 1000).toBeCloseTo(12.9, 0);
  });

  it('lists a place Apple gives twice, or under two kinds, once, as a scenic view', () => {
    const list = orderViewpoints(GRAND_CANYON, [MATHER_AS_CENTER, LIPAN, MATHER, LIPAN]);

    expect(list.map(({ name, category }) => [name, category])).toEqual([
      ['Mather Point', 'scenicView'],
      ['Lipan Point', 'scenicView'],
    ]);
  });

  it('keeps places that share a name but lie far apart', () => {
    const eastRimA = point('East Rim', 36.14831, -112.1785);
    const eastRimB = point('East Rim', 36.10995, -112.03041);

    expect(orderViewpoints(GRAND_CANYON, [eastRimA, eastRimB])).toHaveLength(2);
  });

  it("leaves out the place itself, so a scenic view's own list doesn't offer it", () => {
    const mather = viewpointPlace(orderViewpoints(GRAND_CANYON, [MATHER])[0]!, GRAND_CANYON);

    expect(orderViewpoints(mather, [MATHER, YAVAPAI]).map((viewpoint) => viewpoint.name)).toEqual([
      'Yavapai Point',
    ]);
    // Found by search, it has Apple's coordinates for the name, a little off.
    const searched = { ...mather, id: placeId('Mather Point', 36.0615, -112.1079) };
    expect(orderViewpoints(searched, [MATHER]).map((viewpoint) => viewpoint.name)).toEqual([]);
  });

  it('lists nothing when nothing turned up', () => {
    expect(orderViewpoints(GRAND_CANYON, [])).toEqual([]);
  });
});

describe('viewpointPlace', () => {
  it('opens a scenic view a little farther out than a visitor center', () => {
    const [mather, center] = orderViewpoints(GRAND_CANYON, [MATHER, VISITOR_CENTER]);

    expect(viewpointPlace(mather!, GRAND_CANYON)).toEqual({
      id: 'mather-point_36.062_-112.108',
      name: 'Mather Point',
      country: 'Grand Canyon',
      lat: 36.06167,
      lon: -112.10779,
      altitude: 1200,
    });
    expect(viewpointPlace(center!, GRAND_CANYON)).toMatchObject({
      name: 'South Rim Visitor Center',
      altitude: PLACE_ALTITUDES.place,
    });
  });

  it("names the park under it, or else the line under the place it's listed for", () => {
    const [mather] = orderViewpoints(GRAND_CANYON, [MATHER]);
    const fromMather = viewpointPlace(mather!, GRAND_CANYON);
    const [yavapai] = orderViewpoints(fromMather, [YAVAPAI]);

    expect(viewpointPlace(yavapai!, fromMather).country).toBe('Grand Canyon');
    const [nearDome] = orderViewpoints(HALF_DOME, [point('Glacier Point', 37.72842, -119.57349)]);
    expect(viewpointPlace(nearDome!, HALF_DOME).country).toBe('Yosemite Valley, United States');
  });
});
