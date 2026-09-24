import type { RefObject } from 'react';

import type { DioramaMapViewRef } from '@diorama/native';

import { useFollowsMe } from './liveMode';
import { useLiveLocation } from './useLiveLocation';

/**
 * Live mode for a map: on a live route (`?live=1`) with location access on,
 * each new fix goes to the map's `followTo`, which glides the city there
 * natively, so it moves with you as you walk or ride. Returns whether it's
 * following, for the map's `showsUserLocation` (Apple's blue dot).
 */
export function useFollowMyLocation(mapRef: RefObject<DioramaMapViewRef | null>): boolean {
  const following = useFollowsMe();
  useLiveLocation(following, (fix) => {
    void mapRef.current?.followTo(fix.latitude, fix.longitude);
  });
  return following;
}
