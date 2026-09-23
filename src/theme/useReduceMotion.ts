import { useSyncExternalStore } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

// One subscription to iOS for the whole app, however many components ask,
// held only while something on screen uses it. `latest` is the last value
// iOS reported (null until it has); it's asked again on every restart.
let latest: boolean | null = null;
const listeners = new Set<() => void>();
let stopListening: (() => void) | null = null;

function report(value: boolean): void {
  if (value === latest) return;
  latest = value;
  listeners.forEach((listener) => listener());
}

function startListening(): () => void {
  let heardChange = false;
  let active = true;
  void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
    // A change reported while this was in flight is newer: keep it.
    if (active && !heardChange) report(value);
  });
  const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
    heardChange = true;
    report(value);
  });
  return () => {
    active = false;
    subscription.remove();
  };
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  stopListening ??= startListening();
  return () => {
    listeners.delete(listener);
    if (listeners.size > 0) return;
    stopListening?.();
    stopListening = null;
  };
}

/**
 * True while Reduce Motion is on (Settings > Accessibility > Motion), and it
 * follows changes made while the app runs, like `useColorScheme` does for
 * dark mode. Reanimated's `useReducedMotion` only knows the setting at
 * launch, so it's just the first guess before iOS answers.
 *
 * Every animation in the app checks this one hook: orbits stop, springs lose
 * their bounce (`springConfig`), and loading pulses hold still.
 */
export function useReduceMotion(): boolean {
  const atLaunch = useReducedMotion();
  return useSyncExternalStore(subscribe, () => latest ?? atLaunch);
}
