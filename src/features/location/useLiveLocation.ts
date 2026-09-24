import * as Location from 'expo-location';
import { useIsFocused } from 'expo-router';
import { useEffect, useEffectEvent } from 'react';

import type { Coordinate } from '@diorama/native';
import { useAppIsActive } from '@/features/viewer/useAppIsActive';

import { createFixThrottle, LIVE_DISTANCE_INTERVAL_M, usableFix } from './liveFix';

/** How live mode asks Core Location to watch: GPS-grade fixes, every few steps. */
export const LIVE_WATCH_OPTIONS: Location.LocationOptions = {
  accuracy: Location.Accuracy.High,
  distanceInterval: LIVE_DISTANCE_INTERVAL_M,
};

/**
 * Watches where you are while `enabled`, this screen is in front (not
 * covered by another screen) and the app is active, and hands each fix to
 * `onFix`: only fixes within 50 m, and at most one a second (see
 * liveFix.ts). Foreground only, with the "while using" access the Current
 * location row already asked for; it never asks. The watch stops as soon
 * as the screen or the app goes out of front, and starts again on return.
 * If access was turned off, it quietly finds nothing.
 */
export function useLiveLocation(enabled: boolean, onFix: (fix: Coordinate) => void): void {
  const isFocused = useIsFocused();
  const isActive = useAppIsActive();
  const handleFix = useEffectEvent(onFix);
  const watching = enabled && isFocused && isActive;

  useEffect(() => {
    if (!watching) return;
    let stopped = false;
    let subscription: Location.LocationSubscription | null = null;
    const throttle = createFixThrottle((fix) => handleFix(fix));
    Location.watchPositionAsync(
      LIVE_WATCH_OPTIONS,
      (location) => {
        const fix = usableFix(location);
        if (fix && !stopped) throttle.push(fix);
      },
      // Access turned off meanwhile, or no fix at all: stay put, quietly.
      () => {},
    ).then(
      (started) => {
        if (stopped) started.remove();
        else subscription = started;
      },
      // It couldn't start (access is off after all): stay put, quietly.
      () => {},
    );
    return () => {
      stopped = true;
      subscription?.remove();
      throttle.cancel();
    };
  }, [watching]);
}
