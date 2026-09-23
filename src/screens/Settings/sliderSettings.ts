import type { SFSymbol } from 'expo-symbols';

import {
  SETTING_RANGES,
  setEyeSeparation,
  setMiniatureIntensity,
  setTrackingSensitivity,
} from '@/features/settings/store';

import { linearScale, logScale, type SliderScale } from './sliderScale';

/** The settings that have a slider. */
export type SliderSetting = keyof typeof SETTING_RANGES;

type EndSymbol = {
  name: SFSymbol;
  /** Point size at the default text size. */
  size: number;
};

type SliderConfig = {
  /** Section header, and what VoiceOver calls the slider. */
  title: string;
  footer: string;
  scale: SliderScale;
  /** Stores a new value (clamped by the store). */
  set: (value: number) => void;
  /** Glyphs at the left and right ends, like the sun at each end of Brightness. */
  minSymbol: EndSymbol;
  maxSymbol: EndSymbol;
  /** Does nothing in mono, so it dims there. */
  stereoOnly?: boolean;
};

const { eyeSeparation, trackingSensitivity, miniatureIntensity } = SETTING_RANGES;

/** Everything a Settings slider shows and does, per setting. */
export const SLIDER_SETTINGS: Readonly<Record<SliderSetting, SliderConfig>> = {
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
