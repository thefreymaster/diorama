import { SETTING_RANGES } from '@/features/settings/store';

import { linearScale, logScale } from '../sliderScale';
import { SLIDER_SETTINGS } from '../sliderSettings';

describe('slider scales', () => {
  it('maps a linear range end to end', () => {
    const scale = linearScale(0, 1);

    expect(scale.toPosition(0)).toBe(0);
    expect(scale.toPosition(0.6)).toBeCloseTo(0.6);
    expect(scale.toPosition(1)).toBe(1);
    expect(scale.fromPosition(0.25)).toBeCloseTo(0.25);
  });

  it('spaces a log range by ratio, so the geometric middle is mid-track', () => {
    const scale = logScale(0.5, 2);

    expect(scale.toPosition(0.5)).toBeCloseTo(0);
    expect(scale.toPosition(1)).toBeCloseTo(0.5);
    expect(scale.toPosition(2)).toBeCloseTo(1);
    expect(scale.fromPosition(0.25)).toBeCloseTo(Math.SQRT1_2);
  });

  it('runs a log range backwards when the left end is larger', () => {
    const scale = logScale(3, 0.3);

    expect(scale.fromPosition(0)).toBeCloseTo(3);
    expect(scale.fromPosition(1)).toBeCloseTo(0.3);
    expect(scale.toPosition(0.3)).toBeCloseTo(1);
  });

  it('round-trips every value in range', () => {
    for (const setting of Object.keys(SETTING_RANGES) as (keyof typeof SETTING_RANGES)[]) {
      const { scale } = SLIDER_SETTINGS[setting];
      const { min, max } = SETTING_RANGES[setting];
      for (const value of [min, (min + max) / 2, max]) {
        expect(scale.fromPosition(scale.toPosition(value))).toBeCloseTo(value);
      }
    }
  });
});

describe('Settings sliders', () => {
  const position = (setting: keyof typeof SETTING_RANGES, value: number) =>
    SLIDER_SETTINGS[setting].scale.toPosition(value);

  it('puts a bigger model to the right: less eye separation', () => {
    expect(position('eyeSeparation', SETTING_RANGES.eyeSeparation.max)).toBeCloseTo(0);
    expect(position('eyeSeparation', SETTING_RANGES.eyeSeparation.min)).toBeCloseTo(1);
    // The default (1×) sits near the middle.
    expect(position('eyeSeparation', 1)).toBeCloseTo(0.48, 2);
  });

  it('puts one-to-one tracking in the middle', () => {
    expect(position('trackingSensitivity', 1)).toBeCloseTo(0.5);
  });

  it('runs the miniature effect from off to full', () => {
    expect(position('miniatureIntensity', 0)).toBe(0);
    expect(position('miniatureIntensity', 1)).toBe(1);
  });
});
