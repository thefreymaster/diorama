import { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { PRESSED_SCALE, springConfig, springs, useReduceMotion } from '@/theme';

/**
 * Press feedback for buttons: a springy shrink while the finger is down.
 * With Reduce Motion on it dims instead of moving, at once. Spread the
 * handlers onto a Pressable and put `animatedStyle` on an Animated view.
 */
export function usePressScale(enabled = true) {
  const reduceMotion = useReduceMotion();
  const pressed = useSharedValue(0);

  // Both branches set both props: one left out would keep its last value
  // when Reduce Motion is switched while the app runs.
  const animatedStyle = useAnimatedStyle(() => {
    const amount = pressed.get();
    return reduceMotion
      ? { opacity: 1 - amount * 0.3, transform: [{ scale: 1 }] }
      : { opacity: 1, transform: [{ scale: 1 - amount * (1 - PRESSED_SCALE) }] };
  });

  const animateTo = (value: 0 | 1) => {
    if (!enabled) return;
    pressed.set(reduceMotion ? value : withSpring(value, springConfig(springs.press, false)));
  };

  return {
    animatedStyle,
    onPressIn: () => animateTo(1),
    onPressOut: () => animateTo(0),
  };
}
