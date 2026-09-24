import { distanceKm, type PlaceKind } from '@diorama/native';

import { CURATED_PLACES, type CuratedCity } from '@/features/cities/curated';
import type { RecentCity } from '@/features/cities/recentsStore';

/**
 * How far apart a search result and a featured city may be and still be the
 * same city. Apple centers a city on its whole area (Tokyo is a prefecture),
 * while ours sit on the landmarks, so this is generous. The name must match too.
 */
export const SAME_CITY_KM = 50;

/**
 * The same for a national park. Parks are bigger than cities, and Apple's
 * point for one can sit far from our view of it: its "Grand Canyon" is about
 * 95 km west of the South Rim.
 */
export const SAME_PARK_KM = 120;

/** A resolved search result: where it is, and what kind of place it is. */
export type SearchedPlace = RecentCity & { kind: PlaceKind };

function sameName(a: string, b: string): boolean {
  // Ignores case and accents: "sao paulo" matches "São Paulo".
  return a.localeCompare(b, 'en', { sensitivity: 'base' }) === 0;
}

/** "Zion National Park" → "Zion". Apple names parks in full; ours are short. */
function withoutNationalPark(name: string): string {
  return name.replace(/\s+national\s+park$/i, '');
}

function isWithin(curated: CuratedCity, place: RecentCity, km: number): boolean {
  return (
    distanceKm(
      { latitude: curated.lat, longitude: curated.lon },
      { latitude: place.lat, longitude: place.lon },
    ) <= km
  );
}

/**
 * The built-in place a search result stands for, if any. Opening that one
 * instead keeps its hand-tuned camera, and Recent never lists Paris twice.
 *
 * - A featured city matches only a city result: "Paris, France" matches;
 *   "Paris, TX", "Montmartre" and a café called Paris don't.
 * - A national park matches a result of any kind with its name, with or
 *   without "National Park", near it: "Grand Canyon National Park" (a place),
 *   the canyon itself (a natural feature) and the town of Grand Canyon, AZ
 *   all open the tuned South Rim view.
 */
export function curatedMatch(place: SearchedPlace): CuratedCity | undefined {
  return CURATED_PLACES.find((curated) =>
    curated.category === 'city'
      ? place.kind === 'city' &&
        sameName(curated.name, place.name) &&
        isWithin(curated, place, SAME_CITY_KM)
      : sameName(curated.name, withoutNationalPark(place.name)) &&
        isWithin(curated, place, SAME_PARK_KM),
  );
}
