import { getCuratedCity } from '@/features/cities/curated';

import { curatedMatch, type SearchedPlace } from '../curatedMatch';

/** Apple Maps' Paris: the city's center, ~4 km from our Trocadéro view. */
const PARIS_FRANCE: SearchedPlace = {
  id: 'paris_48.857_2.352',
  name: 'Paris',
  country: 'France',
  lat: 48.8566,
  lon: 2.3522,
  altitude: 1500,
  kind: 'city',
};

/** Apple Maps' "Grand Canyon National Park", as `resolve()` returned it (Sept 2026). */
const GRAND_CANYON_PARK: SearchedPlace = {
  id: 'grand-canyon-national-park_36.237_-112.191',
  name: 'Grand Canyon National Park',
  country: 'Grand Canyon Village, United States',
  lat: 36.236859,
  lon: -112.191467,
  altitude: 900,
  kind: 'place',
};

/** Apple Maps' "Mount Everest", as `resolve()` returned it (Sept 2026): the summit, no subtitle. */
const MOUNT_EVEREST: SearchedPlace = {
  id: 'mount-everest_27.988_86.925',
  name: 'Mount Everest',
  country: '',
  lat: 27.98816,
  lon: 86.9251,
  altitude: 3000,
  kind: 'city',
};

describe('curatedMatch, featured cities', () => {
  it('finds the featured city a search result stands for', () => {
    expect(curatedMatch(PARIS_FRANCE)).toBe(getCuratedCity('paris'));
  });

  it('ignores case and accents in the name', () => {
    expect(curatedMatch({ ...PARIS_FRANCE, name: 'PARÍS' })?.id).toBe('paris');
  });

  it('needs the same name: a neighborhood is not the city', () => {
    expect(curatedMatch({ ...PARIS_FRANCE, name: 'Montmartre', lat: 48.8867, lon: 2.3431 })).toBe(
      undefined,
    );
  });

  it('needs the same place: Paris, TX is not Paris', () => {
    expect(
      curatedMatch({ ...PARIS_FRANCE, country: 'United States', lat: 33.6609, lon: -95.5555 }),
    ).toBe(undefined);
  });

  it('needs a city: an address or a place called Paris is not Paris', () => {
    expect(curatedMatch({ ...PARIS_FRANCE, kind: 'place' })).toBe(undefined);
    expect(curatedMatch({ ...PARIS_FRANCE, kind: 'address' })).toBe(undefined);
  });
});

describe('curatedMatch, national parks', () => {
  it('finds the park from its full name', () => {
    expect(curatedMatch(GRAND_CANYON_PARK)).toBe(getCuratedCity('grand-canyon'));
  });

  // Each as Apple Maps resolved it (Sept 2026): the canyon is a natural
  // feature ~95 km west of the South Rim; the town sits by the South Rim.
  it.each([
    ['the canyon itself', { name: 'Grand Canyon', lat: 36.219038, lon: -113.16096, kind: 'city' }],
    ['the town', { name: 'Grand Canyon', lat: 35.952991, lon: -112.140831, kind: 'city' }],
    ['a natural feature', { name: 'Grand Canyon', lat: 36.1, lon: -112.1, kind: 'address' }],
    ['any case', { name: 'grand canyon national park' }],
  ] as const)('matches %s', (_label, changes) => {
    expect(curatedMatch({ ...GRAND_CANYON_PARK, ...changes })?.id).toBe('grand-canyon');
  });

  it.each([
    ['Yellowstone National Park', 44.567237, -110.586471, 'yellowstone'],
    ['Yosemite National Park', 37.848859, -119.557088, 'yosemite'],
    ['Grand Teton National Park', 43.811082, -110.649503, 'grand-teton'],
    ['Bryce Canyon National Park', 37.576147, -112.182083, 'bryce-canyon'],
    ['Mount Everest', 27.98816, 86.9251, 'mount-everest'],
  ])('finds %s', (name, lat, lon, id) => {
    expect(curatedMatch({ ...GRAND_CANYON_PARK, name, lat, lon })?.id).toBe(id);
  });

  it('finds Mount Everest from the summit Apple returns, of any kind', () => {
    expect(curatedMatch(MOUNT_EVEREST)).toBe(getCuratedCity('mount-everest'));
    expect(curatedMatch({ ...MOUNT_EVEREST, kind: 'address' })?.id).toBe('mount-everest');
    expect(curatedMatch({ ...MOUNT_EVEREST, name: 'mount everest' })?.id).toBe('mount-everest');
  });

  it('needs the same place: a Mount Everest far from Nepal is not ours', () => {
    expect(curatedMatch({ ...MOUNT_EVEREST, lat: 32.8328, lon: -117.1713 })).toBe(undefined);
  });

  it('leaves parks that are no longer suggested to open as searched', () => {
    // Glacier National Park and Mount Rainier, as Apple resolved them (Sept 2026).
    expect(
      curatedMatch({
        ...GRAND_CANYON_PARK,
        name: 'Glacier National Park',
        lat: 48.527512,
        lon: -113.994007,
      }),
    ).toBe(undefined);
    expect(
      curatedMatch({ ...GRAND_CANYON_PARK, name: 'Mount Rainier', lat: 46.85288, lon: -121.76034 }),
    ).toBe(undefined);
  });

  it('needs the same name: another canyon nearby is not the Grand Canyon', () => {
    expect(curatedMatch({ ...GRAND_CANYON_PARK, name: 'Grand Canyon West' })).toBe(undefined);
    expect(curatedMatch({ ...GRAND_CANYON_PARK, name: 'Grand Canyon Village' })).toBe(undefined);
  });
});
