import { useEffect } from 'react';
import { interpolate, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { springConfig, springs, useReduceMotion } from '@/theme';
import { canUseLiquidGlass } from '@/ui';

/** The HUD grows from this scale as it appears, like a system HUD. */
const HIDDEN_SCALE = 0.9;

/**
 * How the HUD shows and hides: it springs in (fading up and growing a
 * little) while `visible`, and springs back out after. Under Reduce Motion
 * it only dissolves, with no overshoot, so it never pops or flickers.
 *
 * On iOS 26 the glass materializes and dissolves by itself (`glassVisible`)
 * and only what's on it fades (`contentStyle`): Liquid Glass isn't drawn at
 * all under a parent that is being faded. Older iOS fades the whole HUD
 * (`containerStyle`), blur and all.
 */
export function useHudFade(visible: boolean) {
  const reduceMotion = useReduceMotion();
  const fadesGlassItself = canUseLiquidGlass();
  const shown = useSharedValue(0);

  useEffect(() => {
    shown.set(withSpring(visible ? 1 : 0, springConfig(springs.gentle, reduceMotion)));
  }, [visible, reduceMotion, shown]);

  const containerStyle = useAnimatedStyle(() => {
    const progress = shown.get();
    const scale = reduceMotion ? 1 : interpolate(progress, [0, 1], [HIDDEN_SCALE, 1]);
    return { opacity: fadesGlassItself ? 1 : progress, transform: [{ scale }] };
  });

  const contentStyle = useAnimatedStyle(() => ({
    opacity: fadesGlassItself ? shown.get() : 1,
  }));

  return { containerStyle, contentStyle, glassVisible: visible };
}
