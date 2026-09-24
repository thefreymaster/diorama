import type { LocationObject } from 'expo-location';

import type { Coordinate } from '@diorama/native';

/**
 * Fixes less sure than this (meters) are dropped: indoors, under trees or
 * between towers GPS wanders by more, and the city would wander with it.
 */
export const LIVE_MAX_ACCURACY_M = 50;

/** A new fix only once you've moved this far (meters): about seven steps. */
export const LIVE_DISTANCE_INTERVAL_M = 5;

/**
 * At most one fix a second goes to the map. It glides to each one over
 * about a second natively, so more would only keep the bridge busy.
 */
export const LIVE_MIN_INTERVAL_MS = 1000;

/**
 * Where a fix puts you, or `null` when it's too unsure to follow: no
 * accuracy, an invalid one (Core Location reports a negative radius for a
 * fix it doesn't trust), or worse than `LIVE_MAX_ACCURACY_M`.
 */
export function usableFix({ coords }: LocationObject): Coordinate | null {
  const { latitude, longitude, accuracy } = coords;
  if (accuracy === null || !(accuracy >= 0) || accuracy > LIVE_MAX_ACCURACY_M) return null;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

/** Passes fixes on at most once per interval (see `createFixThrottle`). */
export type FixThrottle = {
  /** A new fix: sent now if the interval is up, else when it is. */
  push: (fix: Coordinate) => void;
  /** Stops: a fix still waiting is dropped. */
  cancel: () => void;
};

/**
 * Sends fixes to `send` at most once every `intervalMs`. A fix that comes
 * sooner waits for the interval to be up, and only the latest one waiting
 * is sent, so the map always heads for where you are now.
 */
export function createFixThrottle(
  send: (fix: Coordinate) => void,
  intervalMs: number = LIVE_MIN_INTERVAL_MS,
): FixThrottle {
  let lastSentAt = -Infinity;
  let waiting: Coordinate | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    timer = null;
    if (!waiting) return;
    const fix = waiting;
    waiting = null;
    lastSentAt = Date.now();
    send(fix);
  };

  return {
    push: (fix) => {
      waiting = fix;
      if (timer) return;
      const wait = lastSentAt + intervalMs - Date.now();
      if (wait <= 0) flush();
      else timer = setTimeout(flush, wait);
    },
    cancel: () => {
      if (timer) clearTimeout(timer);
      timer = null;
      waiting = null;
    },
  };
}
