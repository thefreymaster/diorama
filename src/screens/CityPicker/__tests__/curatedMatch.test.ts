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
    ['Glacier National Park', 48.527512, -113.994007, 'glacier'],
    ['Mount Rainier', 46.85288, -121.76034, 'mount-rainier'],
  ])('finds %s', (name, lat, lon, id) => {
    expect(curatedMatch({ ...GRAND_CANYON_PARK, name, lat, lon })?.id).toBe(id);
  });

  it('needs the same place: a Glacier National Park elsewhere is not ours', () => {
    // Glacier National Park in British Columbia.
    expect(
      curatedMatch({ ...GRAND_CANYON_PARK, name: 'Glacier National Park', lat: 51.3, lon: -117.5 }),
    ).toBe(undefined);
  });

  it('needs the same name: another canyon nearby is not the Grand Canyon', () => {
    expect(curatedMatch({ ...GRAND_CANYON_PARK, name: 'Grand Canyon West' })).toBe(undefined);
    expect(curatedMatch({ ...GRAND_CANYON_PARK, name: 'Grand Canyon Village' })).toBe(undefined);
  });
});
