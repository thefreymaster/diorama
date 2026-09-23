import type { WithSpringConfig } from 'react-native-reanimated';

/**
 * Spring presets. Motion in the app is springs, never linear fades.
 * Under Reduce Motion the primitives skip these and change state instantly.
 */
export const springs = {
  /** Button press-in/out: quick, with a hint of overshoot. */
  press: { stiffness: 500, damping: 30, mass: 1 },
  /** Larger UI moving into place (cards, HUDs). */
  gentle: { stiffness: 220, damping: 26, mass: 1 },
} as const satisfies Record<string, WithSpringConfig>;

/** Scale a pressed control shrinks to. */
export const PRESSED_SCALE = 0.96;
