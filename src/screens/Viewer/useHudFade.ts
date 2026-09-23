import { useEffect } from 'react';
import { interpolate, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { springConfig, springs, useReduceMotion } from '@/theme';

/** The HUD grows from this scale as it appears, like a system HUD. */
const HIDDEN_SCALE = 0.9;

/**
 * Style for the HUD: it springs in (fading up and growing a little) while
 * `visible`, and springs back out after. Under Reduce Motion it only
 * dissolves, which the setting allows, with no overshoot, so it never pops
 * or flickers.
 */
export function useHudFade(visible: boolean) {
  const reduceMotion = useReduceMotion();
  const shown = useSharedValue(0);

  useEffect(() => {
    shown.set(withSpring(visible ? 1 : 0, springConfig(springs.gentle, reduceMotion)));
  }, [visible, reduceMotion, shown]);

  return useAnimatedStyle(() => {
    const progress = shown.get();
    const scale = reduceMotion ? 1 : interpolate(progress, [0, 1], [HIDDEN_SCALE, 1]);
    return { opacity: progress, transform: [{ scale }] };
  });
}
