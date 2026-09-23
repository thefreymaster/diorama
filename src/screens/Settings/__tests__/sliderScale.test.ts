import { SETTING_RANGES } from '@/features/settings/store';

import { linearScale, logScale, steppedScale } from '../sliderScale';
import {
  FIT_SETTINGS,
  SLIDER_SETTINGS,
  sliderConfig,
  type FitSetting,
  type GlyphSliderSetting,
  type SliderSetting,
} from '../sliderSettings';

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

  it('snaps a stepped range to whole steps', () => {
    const scale = steppedScale(55, 72, 1);

    expect(scale.fromPosition(0)).toBe(55);
    expect(scale.fromPosition(1)).toBe(72);
    expect(scale.toPosition(64)).toBeCloseTo(9 / 17);
    expect(scale.fromPosition(scale.toPosition(64) + 0.02)).toBe(64);
    expect(scale.fromPosition(scale.toPosition(64) + 0.04)).toBe(65);
    expect(scale.positionStep).toBeCloseTo(1 / 17);
  });

  it('round-trips every value in range', () => {
    for (const setting of Object.keys(SETTING_RANGES) as SliderSetting[]) {
      const { scale } = sliderConfig(setting);
      const { min, max } = SETTING_RANGES[setting];
      // The viewer fit sliders snap to whole millimeters.
      const middle = setting in FIT_SETTINGS ? Math.round((min + max) / 2) : (min + max) / 2;
      for (const value of [min, middle, max]) {
        expect(scale.fromPosition(scale.toPosition(value))).toBeCloseTo(value);
      }
    }
  });
});

describe('Settings sliders', () => {
  const position = (setting: GlyphSliderSetting, value: number) =>
    SLIDER_SETTINGS[setting].scale.toPosition(value);

  it('puts a bigger model to the right: less eye separation', () => {
    expect(position('eyeSeparation', SETTING_RANGES.eyeSeparation.max)).toBeCloseTo(0);
    expect(position('eyeSeparation', SETTING_RANGES.eyeSeparation.min)).toBeCloseTo(1);
    // The default (1×) sits near the middle.
    expect(position('eyeSeparation', 1)).toBeCloseTo(0.48, 2);
  });

  it("puts a higher camera to the right, with the city's own height near the middle", () => {
    expect(position('cameraHeight', 0.4)).toBeCloseTo(0);
    expect(position('cameraHeight', 3)).toBeCloseTo(1);
    expect(position('cameraHeight', 1)).toBeCloseTo(0.45, 2);
    // By ratio: half as high is as far left of 1× as twice as high is right.
    const half = position('cameraHeight', 1) - position('cameraHeight', 0.5);
    const double = position('cameraHeight', 2) - position('cameraHeight', 1);
    expect(half).toBeCloseTo(double);
    expect(SLIDER_SETTINGS.cameraHeight.scale.fromPosition(0.5)).toBeCloseTo(Math.sqrt(1.2));
  });

  it('puts one-to-one tracking in the middle', () => {
    expect(position('trackingSensitivity', 1)).toBeCloseTo(0.5);
  });

  it('runs the miniature effect from off to full', () => {
    expect(position('miniatureIntensity', 0)).toBe(0);
    expect(position('miniatureIntensity', 1)).toBe(1);
  });
});

describe('Viewer fit sliders', () => {
  it.each<[FitSetting, number, number]>([
    ['lensSpacing', 55, 72],
    ['windowDiameter', 25, 45],
  ])('runs %s from %d to %d mm in whole millimeters', (setting, min, max) => {
    const { scale } = FIT_SETTINGS[setting];

    expect(scale.fromPosition(0)).toBe(min);
    expect(scale.fromPosition(1)).toBe(max);
    expect(scale.positionStep).toBeCloseTo(1 / (max - min));
    for (const position of [0.13, 0.5, 0.77]) {
      expect(Number.isInteger(scale.fromPosition(position))).toBe(true);
    }
  });
});
