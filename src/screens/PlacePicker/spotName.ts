import { queryOptions } from '@tanstack/react-query';
import * as Location from 'expo-location';

import type { Coordinate } from '@diorama/native';
import { GEOCODE_TIMEOUT_MS } from '@/features/location/locateMe';

import { withTimeout } from './withTimeout';

/**
 * Look a spot's name up only once the map has rested this long, so a few
 * quick pans in a row ask Apple Maps once, not once per pan.
 */
export const NAME_DEBOUNCE_MS = 400;

/** Degrees rounded to 4 places, about 10 m: spots this close share a name. */
function cell(degrees: number): number {
  return Math.round(degrees * 1e4) / 1e4;
}

/** The query key for a spot's name. Equal keys, same name. */
export function spotNameKey({ latitude, longitude }: Coordinate) {
  return ['location', 'spotName', cell(latitude), cell(longitude)] as const;
}

/** The address Apple Maps gives for a spot, or `null` where it has none. */
async function lookUpAddress({
  latitude,
  longitude,
}: Coordinate): Promise<Location.LocationGeocodedAddress | null> {
  const [first] = await withTimeout(
    Location.reverseGeocodeAsync({ latitude, longitude }),
    GEOCODE_TIMEOUT_MS,
  );
  return first ?? null;
}

/**
 * A spot's address, as a query. Each spot has its own key, so an answer
 * that comes late, for a spot the map has since moved on from, lands under
 * that old spot and never shows as the new one's name. Kept for the session:
 * moving back to a spot names it at once.
 */
export function spotNameQuery(spot: Coordinate) {
  return queryOptions({
    queryKey: spotNameKey(spot),
    queryFn: () => lookUpAddress(spot),
    staleTime: Infinity,
    // Apple Maps answers or the time limit does; nothing to wait for.
    networkMode: 'always',
    retry: false,
  });
}
