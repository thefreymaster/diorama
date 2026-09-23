import { useEffect } from 'react';
import { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { springs } from '@/theme';

/**
 * Style for a plain cover over the map: opaque while the map loads, then it
 * springs away once the first frame is drawn, so the city blooms in instead
 * of popping in tile by tile. A dissolve, so it stays under Reduce Motion.
 *
 * The map itself stays fully opaque underneath: MapKit might not draw (or
 * report "rendered") for a view that is invisible.
 */
export function useMapReveal(isReady: boolean) {
  const cover = useSharedValue(1);

  useEffect(() => {
    if (isReady) cover.set(withSpring(0, springs.gentle));
  }, [isReady, cover]);

  return useAnimatedStyle(() => ({ opacity: cover.get() }));
}
