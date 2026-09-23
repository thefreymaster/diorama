import { distanceKm } from '@diorama/native';

import { CURATED_CITIES, type CuratedCity } from '@/features/cities/curated';
import type { RecentCity } from '@/features/cities/recentsStore';

/**
 * How far apart a search result and a featured city may be and still be the
 * same city. Apple centers a city on its whole area (Tokyo is a prefecture),
 * while ours sit on the landmarks, so this is generous. The name must match too.
 */
export const SAME_CITY_KM = 50;

function sameName(a: string, b: string): boolean {
  // Ignores case and accents: "sao paulo" matches "São Paulo".
  return a.localeCompare(b, 'en', { sensitivity: 'base' }) === 0;
}

/**
 * The featured city a search result stands for, if any. Opening that one
 * instead keeps its hand-tuned camera, and Recent never lists Paris twice.
 * "Paris, France" matches; "Paris, TX" and "Montmartre" don't.
 */
export function curatedMatch(place: RecentCity): CuratedCity | undefined {
  return CURATED_CITIES.find(
    (city) =>
      sameName(city.name, place.name) &&
      distanceKm(
        { latitude: city.lat, longitude: city.lon },
        { latitude: place.lat, longitude: place.lon },
      ) <= SAME_CITY_KM,
  );
}
