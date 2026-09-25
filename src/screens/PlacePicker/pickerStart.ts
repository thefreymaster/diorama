import * as Location from 'expo-location';

import type { Coordinate } from '@diorama/native';
import { getCuratedCity } from '@/features/cities/curated';
import { getRecents, type RecentCity } from '@/features/cities/recentsStore';
import { readLocationAccess } from '@/features/location/locateMe';

import { spanForAltitude } from './pickedPlace';
import { withTimeout } from './withTimeout';

/** Where the picker map opens: the spot under the pin, and meters across. */
export type PickerStart = {
  center: Coordinate;
  span: number;
};

/**
 * Meters across the map when it opens where you are (or at a linked spot
 * with no `span`): a neighborhood, streets and landmarks readable.
 */
export const NEARBY_SPAN_M = 3000;

/** Start elsewhere if where you are isn't known within this long. */
export const START_LOCATE_TIMEOUT_MS = 3000;

/** A linked span outside this (meters) is clamped: a few houses to half the Earth. */
const LINKED_SPAN_RANGE = { min: 100, max: 20_000_000 } as const;

/** With nothing in Recent and no location access, the map opens on Midtown. */
const FALLBACK_CITY_ID = 'new-york';

/** Search params arrive as strings (or several, if repeated). */
type Param = string | string[] | undefined;

function numberParam(value: Param): number | null {
  const text = Array.isArray(value) ? value[0] : value;
  if (text === undefined || text.trim() === '') return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * The start a link asks for (`/pick?lat=48.8584&lon=2.2945&span=2000`), or
 * `null` without a valid `lat` and `lon`. `span` is optional.
 */
export function startFromParams(params: {
  lat?: Param;
  lon?: Param;
  span?: Param;
}): PickerStart | null {
  const latitude = numberParam(params.lat);
  const longitude = numberParam(params.lon);
  if (latitude === null || longitude === null) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  const span = numberParam(params.span);
  const { min, max } = LINKED_SPAN_RANGE;
  return {
    center: { latitude, longitude },
    span: span !== null && span > 0 ? Math.min(max, Math.max(min, span)) : NEARBY_SPAN_M,
  };
}

/** A place as the map would frame it: the span its diorama shows. */
function startAt({ lat, lon, altitude }: RecentCity): PickerStart {
  return { center: { latitude: lat, longitude: lon }, span: spanForAltitude(altitude) };
}

/** The newest place in Recent, else New York. */
export function fallbackStart(): PickerStart {
  const place = getRecents().at(0) ?? getCuratedCity(FALLBACK_CITY_ID);
  return place
    ? startAt(place)
    : { center: { latitude: 40.7549, longitude: -73.984 }, span: NEARBY_SPAN_M };
}

/**
 * Where you are, only if location access was already given (the picker
 * never asks): the phone's last fix if it has one, else a fresh one.
 */
async function whereYouAre(): Promise<Coordinate | null> {
  if ((await readLocationAccess()) !== 'granted') return null;
  const position =
    (await Location.getLastKnownPositionAsync()) ??
    (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
  const { latitude, longitude } = position.coords;
  return { latitude, longitude };
}

/**
 * Where the picker opens without a link: where you are if location access
 * is on (and a fix comes quickly), else the newest Recent place, else New
 * York. Never rejects.
 */
export async function findStart(): Promise<PickerStart> {
  const here = await withTimeout(whereYouAre(), START_LOCATE_TIMEOUT_MS).catch(() => null);
  return here ? { center: here, span: NEARBY_SPAN_M } : fallbackStart();
}
