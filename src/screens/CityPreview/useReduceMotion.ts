import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

/**
 * True while Reduce Motion is on (Settings > Accessibility > Motion).
 * Reanimated's `useReducedMotion` only knows the setting at launch; this
 * starts from that value and then follows changes made while the app runs,
 * like `useColorScheme` does for dark mode.
 */
export function useReduceMotion(): boolean {
  const atLaunch = useReducedMotion();
  const [enabled, setEnabled] = useState(atLaunch);

  useEffect(() => {
    let subscribed = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (subscribed) setEnabled(value);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setEnabled);
    return () => {
      subscribed = false;
      subscription.remove();
    };
  }, []);

  return enabled;
}
