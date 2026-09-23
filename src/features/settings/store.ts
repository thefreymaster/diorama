import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { createPersistStorage } from '@/providers/storage';

export type ViewMode = 'mono' | 'stereo';

export type Settings = {
  /** Multiplier on the altitude-derived stereo baseline ("model size"). */
  eyeSeparation: number;
  /**
   * Multiplier on each place's own camera distance: below 1 is closer to the
   * city, above 1 higher above it. See `cameraAltitude` in features/map.
   */
  cameraHeight: number;
  /** How strongly head motion turns the camera. */
  trackingSensitivity: number;
  /** Tilt-shift blur and saturation strength, 0 to 1. */
  miniatureIntensity: number;
  mode: ViewMode;
  /** Simulator only: drag to look around instead of using the gyro. */
  debugLook: boolean;
  /** Viewer fit: millimeters between the centers of the headset's two lenses. */
  lensSpacing: number;
  /** Viewer fit: diameter of each eye's round window, in millimeters. Fills the lens hole. */
  windowDiameter: number;
};

type NumericSetting =
  | 'eyeSeparation'
  | 'cameraHeight'
  | 'trackingSensitivity'
  | 'miniatureIntensity'
  | 'lensSpacing'
  | 'windowDiameter';

/**
 * The viewer fit defaults match the native view's own (`DEFAULT_LENS_SPACING`
 * and `DEFAULT_WINDOW_DIAMETER` in `@diorama/native`): Cardboard v2 lenses
 * 64 mm apart, and round windows 35 mm across, filling round lens holes.
 */
export const DEFAULT_SETTINGS: Readonly<Settings> = {
  eyeSeparation: 1.0,
  cameraHeight: 1.0,
  trackingSensitivity: 1.0,
  miniatureIntensity: 0.6,
  mode: 'stereo',
  debugLook: false,
  lensSpacing: 64,
  windowDiameter: 35,
};

/** Allowed range for each slider. Setters clamp to these. */
export const SETTING_RANGES: Readonly<Record<NumericSetting, { min: number; max: number }>> = {
  eyeSeparation: { min: 0.3, max: 3 },
  cameraHeight: { min: 0.4, max: 3 },
  trackingSensitivity: { min: 0.5, max: 2 },
  miniatureIntensity: { min: 0, max: 1 },
  lensSpacing: { min: 55, max: 72 },
  windowDiameter: { min: 25, max: 45 },
};

const NUMERIC_SETTINGS = Object.keys(SETTING_RANGES) as NumericSetting[];

function clampSetting(key: NumericSetting, value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_SETTINGS[key];
  const { min, max } = SETTING_RANGES[key];
  return Math.min(max, Math.max(min, value));
}

/**
 * Keeps only valid, current fields from whatever was on disk. Anything else
 * is dropped, like the separate window width and height saved before the
 * windows were round: those saves get the default diameter.
 */
function sanitizePersisted(persisted: unknown): Partial<Settings> {
  if (typeof persisted !== 'object' || persisted === null) return {};
  const saved = persisted as Partial<Record<keyof Settings, unknown>>;
  const clean: Partial<Settings> = {};
  for (const key of NUMERIC_SETTINGS) {
    const value = saved[key];
    if (typeof value === 'number') clean[key] = clampSetting(key, value);
  }
  if (saved.mode === 'mono' || saved.mode === 'stereo') clean.mode = saved.mode;
  if (typeof saved.debugLook === 'boolean') clean.debugLook = saved.debugLook;
  return clean;
}

const useSettingsStore = create<Settings>()(
  persist(() => ({ ...DEFAULT_SETTINGS }), {
    name: 'settings',
    // Still 1: new settings (like the viewer fit and camera height) are
    // simply missing from older saves, and `merge` fills them in from the
    // defaults, while settings that are gone (the old window width and
    // height) are left out.
    // Bump it only when a saved value changes meaning, with a `migrate` to
    // convert it.
    version: 1,
    storage: createPersistStorage<Settings>(),
    merge: (persisted, current) => ({ ...current, ...sanitizePersisted(persisted) }),
  }),
);

// Hooks

/** Every setting. Re-renders when any of them changes. */
export function useSettings(): Settings {
  return useSettingsStore((state) => state);
}

/** One setting. Re-renders only when that setting changes. */
export function useSetting<K extends keyof Settings>(key: K): Settings[K] {
  return useSettingsStore((state) => state[key]);
}

// Actions (callable from anywhere, no hook needed)

export function getSettings(): Settings {
  return useSettingsStore.getState();
}

export function setEyeSeparation(value: number): void {
  useSettingsStore.setState({ eyeSeparation: clampSetting('eyeSeparation', value) });
}

export function setCameraHeight(value: number): void {
  useSettingsStore.setState({ cameraHeight: clampSetting('cameraHeight', value) });
}

export function setTrackingSensitivity(value: number): void {
  useSettingsStore.setState({ trackingSensitivity: clampSetting('trackingSensitivity', value) });
}

export function setMiniatureIntensity(value: number): void {
  useSettingsStore.setState({ miniatureIntensity: clampSetting('miniatureIntensity', value) });
}

export function setMode(mode: ViewMode): void {
  useSettingsStore.setState({ mode });
}

export function setDebugLook(debugLook: boolean): void {
  useSettingsStore.setState({ debugLook });
}

export function setLensSpacing(value: number): void {
  useSettingsStore.setState({ lensSpacing: clampSetting('lensSpacing', value) });
}

export function setWindowDiameter(value: number): void {
  useSettingsStore.setState({ windowDiameter: clampSetting('windowDiameter', value) });
}

export function resetSettings(): void {
  useSettingsStore.setState({ ...DEFAULT_SETTINGS });
}
