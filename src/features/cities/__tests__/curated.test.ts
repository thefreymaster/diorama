import {
  FLYOVER_AREAS,
  distanceKm,
  flyoverCoverageAt,
} from '../../../../modules/diorama-native/src/flyoverCoverage';
import {
  CURATED_CITIES,
  CURATED_PARKS,
  CURATED_PLACES,
  getCuratedCity,
  type CuratedCity,
} from '../curated';

const URL_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function center(city: CuratedCity) {
  return { latitude: city.lat, longitude: city.lon };
}

/** Name of the checked 3D area that contains the city's center, if any. */
function flyoverAreaFor(city: CuratedCity): string | undefined {
  return FLYOVER_AREAS.find((area) => distanceKm(center(city), area) <= area.radiusKm)?.name;
}

describe('curated cities', () => {
  it('has about 20 cities', () => {
    expect(CURATED_CITIES.length).toBeGreaterThanOrEqual(15);
    expect(CURATED_CITIES.length).toBeLessThanOrEqual(25);
  });

  it('are all cities', () => {
    for (const city of CURATED_CITIES) expect(city.category).toBe('city');
  });

  it('has unique, URL-safe ids and unique names, parks included', () => {
    const ids = CURATED_PLACES.map((place) => place.id);
    const names = CURATED_PLACES.map((place) => place.name);

    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(names).size).toBe(names.length);
    for (const id of ids) expect(id).toMatch(URL_SLUG);
  });

  it.each(CURATED_CITIES.map((city) => [city.id, city] as const))(
    '%s has in-range coordinates and a sensible camera',
    (_id, city) => {
      expect(city.lat).toBeGreaterThanOrEqual(-90);
      expect(city.lat).toBeLessThanOrEqual(90);
      expect(city.lon).toBeGreaterThanOrEqual(-180);
      expect(city.lon).toBeLessThanOrEqual(180);
      expect(city.altitude).toBeGreaterThanOrEqual(500);
      expect(city.altitude).toBeLessThanOrEqual(3000);
      expect(city.pitch).toBeGreaterThanOrEqual(0);
      expect(city.pitch).toBeLessThanOrEqual(75);
      expect(city.heading).toBeGreaterThanOrEqual(0);
      expect(city.heading).toBeLessThan(360);
      expect(city.name.trim()).not.toBe('');
      expect(city.country.trim()).not.toBe('');
    },
  );

  // Coverage was checked by screenshot in T04. A city outside it would show
  // flat imagery, which is exactly what "Featured" must never do.
  it.each(CURATED_CITIES.map((city) => [city.id, city] as const))(
    '%s is inside a checked 3D (Flyover) area',
    (_id, city) => {
      expect(flyoverAreaFor(city)).toEqual(expect.any(String));
    },
  );

  it('leaves out Dubai, which is flat imagery only', () => {
    expect(getCuratedCity('dubai')).toBeUndefined();
  });

  it('finds a city by id', () => {
    expect(getCuratedCity('paris')?.name).toBe('Paris');
    expect(getCuratedCity('new-york')?.country).toBe('United States');
    expect(getCuratedCity('atlantis')).toBeUndefined();
  });
});

describe('curated national parks', () => {
  it('has about 10 parks, Grand Canyon and Yellowstone first', () => {
    expect(CURATED_PARKS.length).toBeGreaterThanOrEqual(8);
    expect(CURATED_PARKS.length).toBeLessThanOrEqual(12);
    expect(CURATED_PARKS.slice(0, 2).map((park) => park.id)).toEqual([
      'grand-canyon',
      'yellowstone',
    ]);
  });

  it('are all parks, listed after the cities', () => {
    for (const park of CURATED_PARKS) expect(park.category).toBe('park');
    expect(CURATED_PLACES).toEqual([...CURATED_CITIES, ...CURATED_PARKS]);
  });

  it.each(CURATED_PARKS.map((park) => [park.id, park] as const))(
    '%s has in-range coordinates, a sensible camera and a "State, United States" subtitle',
    (_id, park) => {
      expect(park.lat).toBeGreaterThanOrEqual(-90);
      expect(park.lat).toBeLessThanOrEqual(90);
      expect(park.lon).toBeGreaterThanOrEqual(-180);
      expect(park.lon).toBeLessThanOrEqual(180);
      // Farther out than a city (it's landscape), but within the app's 5 km camera limit.
      expect(park.altitude).toBeGreaterThanOrEqual(1500);
      expect(park.altitude).toBeLessThanOrEqual(5000);
      expect(park.pitch).toBeGreaterThanOrEqual(0);
      expect(park.pitch).toBeLessThanOrEqual(75);
      expect(park.heading).toBeGreaterThanOrEqual(0);
      expect(park.heading).toBeLessThan(360);
      expect(park.name.trim()).not.toBe('');
      expect(park.country).toMatch(/^[A-Z][A-Za-z ]+, United States$/);
    },
  );

  // No 3D buildings to promise, and no "terrain only" note either (T28):
  // the preview says nothing about coverage for a park.
  it.each(CURATED_PARKS.map((park) => [park.id, park] as const))(
    '%s has unknown 3D coverage',
    (_id, park) => {
      expect(flyoverCoverageAt(center(park))).toBe('unknown');
    },
  );

  it('finds a park by id, like a city', () => {
    expect(getCuratedCity('grand-canyon')?.name).toBe('Grand Canyon');
    expect(getCuratedCity('yellowstone')?.country).toBe('Wyoming, United States');
  });
});
