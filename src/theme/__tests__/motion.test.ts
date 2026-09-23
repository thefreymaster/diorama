import { ReduceMotion } from 'react-native-reanimated';

import { springConfig, springs } from '../motion';

describe('springConfig', () => {
  it('keeps the preset, bounce and all, with Reduce Motion off', () => {
    expect(springConfig(springs.gentle, false)).toEqual({
      ...springs.gentle,
      reduceMotion: ReduceMotion.Never,
    });
  });

  it('takes the bounce out under Reduce Motion: critically damped and clamped', () => {
    for (const spring of Object.values(springs)) {
      const config = springConfig(spring, true);

      expect(config.damping).toBeCloseTo(2 * Math.sqrt(spring.stiffness * spring.mass));
      expect(config.damping).toBeGreaterThan(spring.damping);
      expect(config.overshootClamping).toBe(true);
      expect(config.stiffness).toBe(spring.stiffness);
    }
  });

  it('always runs the spring, so the live setting decides rather than the one at launch', () => {
    expect(springConfig(springs.press, false).reduceMotion).toBe(ReduceMotion.Never);
    expect(springConfig(springs.press, true).reduceMotion).toBe(ReduceMotion.Never);
  });
});
