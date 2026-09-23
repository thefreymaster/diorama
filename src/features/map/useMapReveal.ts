import { useEffect } from 'react';
import { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { springConfig, springs, useReduceMotion } from '@/theme';

/**
 * Style for a plain cover over a map: opaque while the map loads, then it
 * springs away once the first frame is drawn, so the city blooms in instead
 * of popping in tile by tile. It's a dissolve, so it stays under Reduce
 * Motion, just without the spring's overshoot.
 *
 * The map itself stays fully opaque underneath: MapKit might not draw (or
 * report "rendered") for a view that is invisible.
 */
export function useMapReveal(isReady: boolean) {
  const reduceMotion = useReduceMotion();
  const cover = useSharedValue(1);

  useEffect(() => {
    if (isReady) cover.set(withSpring(0, springConfig(springs.gentle, reduceMotion)));
  }, [isReady, reduceMotion, cover]);

  return useAnimatedStyle(() => ({ opacity: cover.get() }));
}
