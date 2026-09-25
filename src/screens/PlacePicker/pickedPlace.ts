import type { LocationGeocodedAddress } from 'expo-location';

import type { Coordinate, PlacePickerRegion } from '@diorama/native';
import type { RecentCity } from '@/features/cities/recentsStore';
import { placeHere } from '@/features/location/placeHere';

/**
 * The diorama's camera sits about a twelfth of the map's width away, the
 * same rule search uses for a city's size: what you framed on the map is
 * about what the diorama shows.
 */
export const ALTITUDE_PER_SPAN = 1 / 12;

/**
 * Closest and farthest camera distances for a picked spot, in meters: zoomed
 * in to a street it's still a model, zoomed out to a country it's a region.
 */
export const PICKED_ALTITUDE_RANGE = { min: 600, max: 4500 } as const;

/** Camera distance (meters) for a map this many meters across. */
export function altitudeForSpan(spanMeters: number): number {
  const { min, max } = PICKED_ALTITUDE_RANGE;
  if (!Number.isFinite(spanMeters)) return min;
  return Math.round(Math.min(max, Math.max(min, spanMeters * ALTITUDE_PER_SPAN)));
}

/** Meters across the map that frame a place at this camera distance. */
export function spanForAltitude(altitude: number): number {
  return altitude / ALTITUDE_PER_SPAN;
}

/** "40.7484° N, 73.9857° W": a spot's name when Apple Maps has none. */
export function formatCoordinates({ latitude, longitude }: Coordinate): string {
  const lat = `${Math.abs(latitude).toFixed(4)}° ${latitude < 0 ? 'S' : 'N'}`;
  const lon = `${Math.abs(longitude).toFixed(4)}° ${longitude < 0 ? 'W' : 'E'}`;
  return `${lat}, ${lon}`;
}

/**
 * The spot under the pin as a place to open and keep in Recent: named like
 * "Current location" names where you stand (the street or place there, and
 * "Town, Country"), or by its coordinates when Apple Maps has no name (or it
 * hasn't come yet), with the camera as far out as the map was wide.
 */
export function pickedPlace(
  spot: PlacePickerRegion,
  address?: LocationGeocodedAddress | null,
): RecentCity {
  const { latitude, longitude, spanMeters } = spot;
  return placeHere({ latitude, longitude, accuracy: null }, address ?? undefined, {
    fallbackName: formatCoordinates(spot),
    altitude: altitudeForSpan(spanMeters),
  });
}
