import * as Location from 'expo-location';

import type { RecentCity } from '@/features/cities/recentsStore';

import { placeHere } from './placeHere';

/**
 * Give up on a fix after this long (indoors, underground, no signal), and
 * on Core Location if it doesn't say at once whether access is on.
 */
export const LOCATE_TIMEOUT_MS = 10_000;

/** Name the spot within this long, or open it as "Current location". */
export const GEOCODE_TIMEOUT_MS = 5_000;

/**
 * Why the phone couldn't say where it is: `denied` when location access is
 * off for Diorama (or restricted, as by Screen Time), `unavailable` when
 * Location Services is off or no fix came in time.
 */
export type LocateFailure = 'denied' | 'unavailable';

export class LocateError extends Error {
  constructor(readonly reason: LocateFailure) {
    super(reason === 'denied' ? 'Location access is off' : 'No location fix');
    this.name = 'LocateError';
  }
}

/** True when `error` says location access is off, so only Settings can help. */
export function isAccessDenied(error: unknown): boolean {
  return error instanceof LocateError && error.reason === 'denied';
}

/**
 * What the app may do with location right now, read without asking:
 * `servicesOff` when Location Services is off for the whole phone.
 */
export type LocationAccess = 'granted' | 'undetermined' | 'denied' | 'servicesOff';

/** Reads the current access. Never shows the permission prompt. */
export async function readLocationAccess(): Promise<LocationAccess> {
  if (!(await Location.hasServicesEnabledAsync())) return 'servicesOff';
  const { status } = await Location.getForegroundPermissionsAsync();
  if (status === Location.PermissionStatus.GRANTED) return 'granted';
  return status === Location.PermissionStatus.DENIED ? 'denied' : 'undetermined';
}

/** `promise`, or a rejection if it hasn't settled within `ms`. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out after ${ms} ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Finds where the phone is and names it, as a place to open and keep in
 * Recent. Asks for "while using" access the first time (the only time iOS
 * shows the prompt), then takes one fix of about a hundred meters. Naming
 * it needs a connection; offline it's still found, as "Current location".
 * Rejects with a `LocateError`.
 */
export async function locateMe(): Promise<RecentCity> {
  let access: LocationAccess;
  try {
    // Core Location answers this at once; if it's stuck, nothing is found.
    access = await withTimeout(readLocationAccess(), LOCATE_TIMEOUT_MS);
  } catch {
    throw new LocateError('unavailable');
  }
  if (access === 'servicesOff') throw new LocateError('unavailable');
  if (access === 'undetermined') {
    // The prompt: no time limit, it waits for an answer.
    const { granted } = await Location.requestForegroundPermissionsAsync();
    access = granted ? 'granted' : 'denied';
  }
  if (access !== 'granted') throw new LocateError('denied');

  let position: Location.LocationObject;
  try {
    position = await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      LOCATE_TIMEOUT_MS,
    );
  } catch {
    throw new LocateError('unavailable');
  }

  const { latitude, longitude, accuracy } = position.coords;
  const address = await withTimeout(
    Location.reverseGeocodeAsync({ latitude, longitude }),
    GEOCODE_TIMEOUT_MS,
  ).then(
    ([first]) => first,
    () => undefined,
  );
  return placeHere({ latitude, longitude, accuracy }, address);
}
