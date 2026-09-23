import { ReduceMotion, type WithSpringConfig } from 'react-native-reanimated';

/** A physical spring: how stiff, how much it's damped, and how heavy. */
type Spring = { stiffness: number; damping: number; mass: number };

/**
 * Spring presets. Motion in the app is springs, never linear fades.
 * Animate with `springConfig(springs.x, reduceMotion)`, not the preset itself.
 */
export const springs = {
  /** Button press-in/out: quick, with a hint of overshoot. */
  press: { stiffness: 500, damping: 30, mass: 1 },
  /** Larger UI moving into place (cards, HUDs). */
  gentle: { stiffness: 220, damping: 26, mass: 1 },
} as const satisfies Record<string, Spring>;

/**
 * The config to hand `withSpring`. With Reduce Motion on, the bounce comes
 * out: the spring is critically damped (and clamped), so it eases into place
 * and stops, never overshooting or wobbling.
 *
 * Either way the spring runs: `useReduceMotion` decides, live. (Left to
 * itself, Reanimated would skip every spring under Reduce Motion, and only
 * know the setting from launch.)
 */
export function springConfig(spring: Spring, reduceMotion: boolean): WithSpringConfig {
  if (!reduceMotion) return { ...spring, reduceMotion: ReduceMotion.Never };
  const { stiffness, mass } = spring;
  return {
    stiffness,
    mass,
    damping: 2 * Math.sqrt(stiffness * mass),
    overshootClamping: true,
    reduceMotion: ReduceMotion.Never,
  };
}

/** Scale a pressed control shrinks to. */
export const PRESSED_SCALE = 0.96;
