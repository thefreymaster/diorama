import { FLYOVER_AREAS, distanceKm } from '../../../../modules/diorama-native/src/flyoverCoverage';
import { CURATED_CITIES, getCuratedCity, type CuratedCity } from '../curated';

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

  it('has unique, URL-safe ids and unique names', () => {
    const ids = CURATED_CITIES.map((city) => city.id);
    const names = CURATED_CITIES.map((city) => city.name);

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
