import { useEffect } from 'react';
import {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useReduceMotion } from '@/theme';

const DIMMEST = 0.45;
const HALF_CYCLE_MS = 900;

/**
 * A slow, eased breathing opacity for loading placeholders. Holds still
 * (fully shown) while the user has Reduce Motion on, including when they
 * turn it on mid-pulse.
 */
export function usePulse() {
  const reduceMotion = useReduceMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) {
      opacity.set(1);
      return;
    }
    opacity.set(
      withRepeat(
        withTiming(DIMMEST, {
          duration: HALF_CYCLE_MS,
          easing: Easing.inOut(Easing.quad),
          reduceMotion: ReduceMotion.Never,
        }),
        -1,
        true,
        undefined,
        // `useReduceMotion` decides, live; Reanimated only knows the setting at launch.
        ReduceMotion.Never,
      ),
    );
    return () => cancelAnimation(opacity);
  }, [reduceMotion, opacity]);

  return useAnimatedStyle(() => ({ opacity: opacity.get() }));
}
