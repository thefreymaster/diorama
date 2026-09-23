import type { SFSymbol } from 'expo-symbols';

import type { Completion, PlaceKind } from '@diorama/native';

/** One titled group of search results. */
export type SearchSection = {
  key: 'cities' | 'places';
  /** Section header, in sentence case (it displays uppercased). */
  title: string;
  completions: Completion[];
};

/** Row glyph for each kind of result. Each exists in SF Symbols 4.2 or earlier (iOS 16.4). */
export const KIND_SYMBOLS: Record<PlaceKind, SFSymbol> = {
  city: 'mappin.and.ellipse',
  address: 'mappin.circle.fill',
  place: 'building.2.fill',
};

/**
 * How much of a result's title matches what was typed, from 0 to 1:
 * "Par" is 0.6 of "Paris" and 0.16 of "Park Street Station".
 */
export function titleMatch({ title, titleHighlights }: Completion): number {
  if (title.length === 0) return 0;
  const matched = new Set<number>();
  for (const { start, length } of titleHighlights) {
    for (let i = Math.max(0, start); i < Math.min(title.length, start + length); i += 1) {
      matched.add(i);
    }
  }
  return matched.size / title.length;
}

/**
 * Splits results into "Cities" and "Places", each in Apple's order, and
 * leaves out an empty one. The section whose top result matches the typed
 * text better comes first, so "Par" leads with Paris rather than Park
 * Street Station. When both match as well ("Eiffel Tower" is also a
 * neighborhood in India), Apple's own ranking decides.
 */
export function searchSections(completions: readonly Completion[]): SearchSection[] {
  const cities: SearchSection = { key: 'cities', title: 'Cities', completions: [] };
  const places: SearchSection = { key: 'places', title: 'Places', completions: [] };
  for (const completion of completions) {
    (completion.kind === 'city' ? cities : places).completions.push(completion);
  }

  const [topCity] = cities.completions;
  const [topPlace] = places.completions;
  if (!topCity) return topPlace ? [places] : [];
  if (!topPlace) return [cities];

  const cityMatch = titleMatch(topCity);
  const placeMatch = titleMatch(topPlace);
  const placesFirst =
    cityMatch === placeMatch
      ? completions.indexOf(topPlace) < completions.indexOf(topCity)
      : placeMatch > cityMatch;
  return placesFirst ? [places, cities] : [cities, places];
}
