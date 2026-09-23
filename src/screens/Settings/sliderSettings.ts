import type { SFSymbol } from 'expo-symbols';

import {
  SETTING_RANGES,
  setEyeSeparation,
  setLensSpacing,
  setMiniatureIntensity,
  setTrackingSensitivity,
  setWindowDiameter,
} from '@/features/settings/store';

import {
  linearScale,
  logScale,
  steppedScale,
  type SliderScale,
  type SteppedScale,
} from './sliderScale';

/** The settings that have a slider. */
export type SliderSetting = keyof typeof SETTING_RANGES;

/** The "Viewer fit" sliders: sizes in millimeters, shown with their value. */
export type FitSetting = 'lensSpacing' | 'windowDiameter';

/** The sliders between two glyphs, each in a section of its own. */
export type GlyphSliderSetting = Exclude<SliderSetting, FitSetting>;

type EndSymbol = {
  name: SFSymbol;
  /** Point size at the default text size. */
  size: number;
};

/** What every slider has, whatever it looks like. */
type SliderConfig = {
  /** What the slider is called, on screen and to VoiceOver. */
  title: string;
  scale: SliderScale;
  /** Stores a new value (clamped by the store). */
  set: (value: number) => void;
  /** Does nothing in mono, so it dims there. */
  stereoOnly?: boolean;
};

type GlyphSliderConfig = SliderConfig & {
  /** Shown under the section; `title` is its header. */
  footer: string;
  /** Glyphs at the left and right ends, like the sun at each end of Brightness. */
  minSymbol: EndSymbol;
  maxSymbol: EndSymbol;
};

type FitSliderConfig = SliderConfig & {
  /** Whole millimeters, so the thumb snaps from one to the next. */
  scale: SteppedScale;
};

const { eyeSeparation, trackingSensitivity, miniatureIntensity } = SETTING_RANGES;
const { lensSpacing, windowDiameter } = SETTING_RANGES;

/** Every glyph slider: what it shows and does. */
export const SLIDER_SETTINGS: Readonly<Record<GlyphSliderSetting, GlyphSliderConfig>> = {
  eyeSeparation: {
    title: 'Model size',
    footer: 'How big the city looks in stereo. Smaller feels more like a model on a table.',
    // Eyes farther apart make the city look smaller, so the widest separation
    // sits at the small end. By ratio, so the default (1×) lands mid-track.
    scale: logScale(eyeSeparation.max, eyeSeparation.min),
    set: setEyeSeparation,
    minSymbol: { name: 'building.2.fill', size: 13 },
    maxSymbol: { name: 'building.2.fill', size: 22 },
    stereoOnly: true,
  },
  trackingSensitivity: {
    title: 'Tracking sensitivity',
    footer: 'How far the city turns when you turn your head.',
    // By ratio, so one to one (1×) is the middle of the track.
    scale: logScale(trackingSensitivity.min, trackingSensitivity.max),
    set: setTrackingSensitivity,
    minSymbol: { name: 'tortoise.fill', size: 17 },
    maxSymbol: { name: 'hare.fill', size: 17 },
  },
  miniatureIntensity: {
    title: 'Miniature effect',
    footer: 'Blurs the top and bottom of the view, like a tilt-shift photo.',
    scale: linearScale(miniatureIntensity.min, miniatureIntensity.max),
    set: setMiniatureIntensity,
    minSymbol: { name: 'camera.macro', size: 13 },
    maxSymbol: { name: 'camera.macro', size: 22 },
  },
};

/** The "Viewer fit" section's sliders, top to bottom. */
export const FIT_SETTINGS: Readonly<Record<FitSetting, FitSliderConfig>> = {
  lensSpacing: {
    title: 'Lens spacing',
    scale: steppedScale(lensSpacing.min, lensSpacing.max, 1),
    set: setLensSpacing,
    stereoOnly: true,
  },
  windowDiameter: {
    title: 'Diameter',
    scale: steppedScale(windowDiameter.min, windowDiameter.max, 1),
    set: setWindowDiameter,
    stereoOnly: true,
  },
};

const ALL_SLIDERS: Readonly<Record<SliderSetting, SliderConfig>> = {
  ...SLIDER_SETTINGS,
  ...FIT_SETTINGS,
};

/** Any slider's title, scale and setter, whichever kind it is. */
export function sliderConfig(setting: SliderSetting): SliderConfig {
  return ALL_SLIDERS[setting];
}
