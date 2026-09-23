import {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { PRESSED_SCALE, springs } from '@/theme';

/**
 * Press feedback for buttons: a springy shrink while the finger is down.
 * With Reduce Motion on it dims instead of moving. Spread the handlers onto
 * a Pressable and put `animatedStyle` on an Animated view.
 */
export function usePressScale(enabled = true) {
  const reduceMotion = useReducedMotion();
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => {
    const amount = pressed.get();
    return reduceMotion
      ? { opacity: 1 - amount * 0.3 }
      : { transform: [{ scale: 1 - amount * (1 - PRESSED_SCALE) }] };
  });

  const animateTo = (value: 0 | 1) => {
    if (!enabled) return;
    pressed.set(reduceMotion ? value : withSpring(value, springs.press));
  };

  return {
    animatedStyle,
    onPressIn: () => animateTo(1),
    onPressOut: () => animateTo(0),
  };
}
