import { useEffect } from 'react';
import {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

const DIMMEST = 0.45;
const HALF_CYCLE_MS = 900;

/**
 * A slow, eased breathing opacity for loading placeholders.
 * Holds still when the user has Reduce Motion on.
 */
export function usePulse() {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) return;
    opacity.set(
      withRepeat(
        withTiming(DIMMEST, { duration: HALF_CYCLE_MS, easing: Easing.inOut(Easing.quad) }),
        -1,
        true,
      ),
    );
    return () => cancelAnimation(opacity);
  }, [reduceMotion, opacity]);

  return useAnimatedStyle(() => ({ opacity: opacity.get() }));
}
