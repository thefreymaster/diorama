import { useEffect } from 'react';
import {
  ReduceMotion,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { useReduceMotion } from '@/screens/CityPreview/useReduceMotion';
import { springs } from '@/theme';

/** The HUD grows from this scale as it appears, like a system HUD. */
const HIDDEN_SCALE = 0.9;

/**
 * Style for the HUD: it springs in (fading up and growing a little) while
 * `visible`, and springs back out after. Under Reduce Motion it only
 * dissolves, which the setting allows, so it never pops.
 */
export function useHudFade(visible: boolean) {
  const reduceMotion = useReduceMotion();
  const shown = useSharedValue(0);

  useEffect(() => {
    // Reanimated would skip the spring under Reduce Motion; the dissolve stays.
    shown.set(withSpring(visible ? 1 : 0, { ...springs.gentle, reduceMotion: ReduceMotion.Never }));
  }, [visible, shown]);

  return useAnimatedStyle(() => {
    const progress = shown.get();
    const scale = reduceMotion ? 1 : interpolate(progress, [0, 1], [HIDDEN_SCALE, 1]);
    return { opacity: progress, transform: [{ scale }] };
  });
}
