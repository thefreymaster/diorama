import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { createPersistStorage } from '@/providers/storage';

export type ViewMode = 'mono' | 'stereo';

export type Settings = {
  /** Multiplier on the altitude-derived stereo baseline ("model size"). */
  eyeSeparation: number;
  /** How strongly head motion turns the camera. */
  trackingSensitivity: number;
  /** Tilt-shift blur and saturation strength, 0 to 1. */
  miniatureIntensity: number;
  mode: ViewMode;
  /** Simulator only: drag to look around instead of using the gyro. */
  debugLook: boolean;
};

type NumericSetting = 'eyeSeparation' | 'trackingSensitivity' | 'miniatureIntensity';

export const DEFAULT_SETTINGS: Readonly<Settings> = {
  eyeSeparation: 1.0,
  trackingSensitivity: 1.0,
  miniatureIntensity: 0.6,
  mode: 'stereo',
  debugLook: false,
};

/** Allowed range for each slider. Setters clamp to these. */
export const SETTING_RANGES: Readonly<Record<NumericSetting, { min: number; max: number }>> = {
  eyeSeparation: { min: 0.3, max: 3 },
  trackingSensitivity: { min: 0.5, max: 2 },
  miniatureIntensity: { min: 0, max: 1 },
};

const NUMERIC_SETTINGS = Object.keys(SETTING_RANGES) as NumericSetting[];

function clampSetting(key: NumericSetting, value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_SETTINGS[key];
  const { min, max } = SETTING_RANGES[key];
  return Math.min(max, Math.max(min, value));
}

/** Keeps only valid fields from whatever was on disk. */
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

export function resetSettings(): void {
  useSettingsStore.setState({ ...DEFAULT_SETTINGS });
}
