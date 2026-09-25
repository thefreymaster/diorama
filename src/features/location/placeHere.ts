import type { LocationGeocodedAddress } from 'expo-location';

import { PLACE_ALTITUDES, placeId, placeSubtitle } from '@diorama/native';

import type { RecentCity } from '@/features/cities/recentsStore';

/** The row's title, and the name of a spot Apple Maps can't name. */
export const CURRENT_LOCATION_NAME = 'Current location';

/**
 * A fix this uncertain (meters) is only roughly where you are, as when
 * Precise Location is off: iOS moves it by up to a few kilometers.
 */
export const APPROXIMATE_ACCURACY_M = 1000;

/** Where the phone is, as Core Location reports it. */
export type Fix = {
  latitude: number;
  longitude: number;
  /** Radius of uncertainty in meters, when known. */
  accuracy: number | null;
};

function firstFilled(...values: (string | null | undefined)[]): string | undefined {
  return values.find((value): value is string => typeof value === 'string' && value.trim() !== '');
}

function roundCoordinate(degrees: number): number {
  return Math.round(degrees * 1e6) / 1e6;
}

/** How to name and frame a spot that isn't where you stand (see `placeHere`). */
export type PlaceHereOptions = {
  /** The name when Apple Maps has none there. Default "Current location". */
  fallbackName?: string;
  /** Camera distance in meters. Default an address's (`PLACE_ALTITUDES.address`). */
  altitude?: number;
};

/**
 * Turns a fix and its reverse-geocoded address into a place the app can
 * open and keep in Recent, framed like an address from search. Its name is
 * the street or place there ("1 City Hall Sq"), or just the town when the
 * fix is approximate (a street picked from a blurred fix would be wrong);
 * with no address at all (offline) it's "Current location". The subtitle is
 * "Town, Country". A spot picked on a map (T43) names itself the same way,
 * with its own fallback name and camera distance (`options`).
 */
export function placeHere(
  fix: Fix,
  address?: LocationGeocodedAddress,
  {
    fallbackName = CURRENT_LOCATION_NAME,
    altitude = PLACE_ALTITUDES.address,
  }: PlaceHereOptions = {},
): RecentCity {
  const lat = roundCoordinate(fix.latitude);
  const lon = roundCoordinate(fix.longitude);
  const town = firstFilled(address?.city, address?.subregion) ?? '';
  const approximate = fix.accuracy !== null && fix.accuracy > APPROXIMATE_ACCURACY_M;
  const name =
    firstFilled(approximate ? town : undefined, address?.name, address?.street) ?? fallbackName;

  return {
    id: placeId(name, lat, lon),
    name,
    country: placeSubtitle({ name, locality: town, country: address?.country ?? '' }, 'address'),
    lat,
    lon,
    altitude,
  };
}
