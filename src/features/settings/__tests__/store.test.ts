import { act, renderHook } from '@testing-library/react-native';

import {
  resetSettings,
  setEyeSeparation,
  setMiniatureIntensity,
  setMode,
  useSetting,
  useSettings,
} from '../store';

type StoreModule = typeof import('../store');
type StorageModule = typeof import('@/providers/storage');

/**
 * Loads fresh copies of the settings store and its MMKV instance, like a cold
 * app launch. `saved` is what was on disk under the `settings` key beforehand.
 */
function launch(saved?: string) {
  let store: StoreModule | undefined;
  let disk: StorageModule['storage'] | undefined;
  jest.isolateModules(() => {
    disk = jest.requireActual<StorageModule>('@/providers/storage').storage;
    if (saved !== undefined) disk.set('settings', saved);
    store = jest.requireActual<StoreModule>('../store');
  });
  if (!store || !disk) throw new Error('launch() failed to load the store');
  return { store, disk };
}

describe('settings store', () => {
  it('starts with the defaults', () => {
    const { store } = launch();

    expect(store.getSettings()).toEqual({
      eyeSeparation: 1.0,
      trackingSensitivity: 1.0,
      miniatureIntensity: 0.6,
      mode: 'stereo',
      debugLook: false,
    });
  });

  it('persists changes to MMKV', () => {
    const { store, disk } = launch();

    store.setEyeSeparation(2);
    store.setMode('mono');

    const saved = JSON.parse(disk.getString('settings') ?? 'null');
    expect(saved.state).toMatchObject({ eyeSeparation: 2, mode: 'mono' });
  });

  it('rehydrates the saved settings on the next launch', () => {
    const first = launch();
    first.store.setEyeSeparation(2.5);
    first.store.setTrackingSensitivity(1.5);
    first.store.setMiniatureIntensity(0.2);
    first.store.setMode('mono');
    first.store.setDebugLook(true);
    const saved = first.disk.getString('settings');

    const second = launch(saved);

    expect(second.store.getSettings()).toEqual({
      eyeSeparation: 2.5,
      trackingSensitivity: 1.5,
      miniatureIntensity: 0.2,
      mode: 'mono',
      debugLook: true,
    });
  });

  it('ignores invalid values on disk', () => {
    const saved = JSON.stringify({
      state: { eyeSeparation: 'big', mode: 'hologram', miniatureIntensity: 7, debugLook: true },
      version: 1,
    });

    const { store } = launch(saved);

    expect(store.getSettings()).toEqual({
      eyeSeparation: 1.0,
      trackingSensitivity: 1.0,
      miniatureIntensity: 1,
      mode: 'stereo',
      debugLook: true,
    });
  });

  it('clamps out-of-range values on disk instead of dropping them', () => {
    const saved = JSON.stringify({
      state: { eyeSeparation: -5, trackingSensitivity: 100, miniatureIntensity: 0.4 },
      version: 1,
    });

    const { store } = launch(saved);

    expect(store.getSettings()).toMatchObject({
      eyeSeparation: store.SETTING_RANGES.eyeSeparation.min,
      trackingSensitivity: store.SETTING_RANGES.trackingSensitivity.max,
      miniatureIntensity: 0.4,
    });
  });

  it.each([
    ['not JSON', '{"state": {"eyeSep'],
    ['a null state', JSON.stringify({ state: null, version: 1 })],
    ['an array state', JSON.stringify({ state: [2, 'mono'], version: 1 })],
    ['a string state', JSON.stringify({ state: 'mono', version: 1 })],
  ])('starts with the defaults when the disk holds %s', (_label, saved) => {
    const { store } = launch(saved);

    expect(store.getSettings()).toEqual(store.DEFAULT_SETTINGS);
  });

  it('replaces corrupt data on disk with the next change', () => {
    const { store, disk } = launch('not json at all');

    store.setMode('mono');

    const saved = JSON.parse(disk.getString('settings') ?? 'null');
    expect(saved).toEqual({ state: { ...store.DEFAULT_SETTINGS, mode: 'mono' }, version: 1 });
  });

  it('clamps sliders to their ranges', () => {
    const { store } = launch();

    store.setEyeSeparation(10);
    store.setTrackingSensitivity(0);
    store.setMiniatureIntensity(Number.NaN);

    expect(store.getSettings()).toMatchObject({
      eyeSeparation: store.SETTING_RANGES.eyeSeparation.max,
      trackingSensitivity: store.SETTING_RANGES.trackingSensitivity.min,
      miniatureIntensity: store.DEFAULT_SETTINGS.miniatureIntensity,
    });
  });

  it('accepts the exact ends of each range, and falls back to the default for infinities', () => {
    const { store } = launch();
    const { eyeSeparation, trackingSensitivity } = store.SETTING_RANGES;

    store.setEyeSeparation(eyeSeparation.min);
    store.setTrackingSensitivity(trackingSensitivity.max);
    expect(store.getSettings()).toMatchObject({
      eyeSeparation: eyeSeparation.min,
      trackingSensitivity: trackingSensitivity.max,
    });

    store.setEyeSeparation(Number.POSITIVE_INFINITY);
    store.setTrackingSensitivity(Number.NEGATIVE_INFINITY);
    expect(store.getSettings()).toMatchObject({
      eyeSeparation: store.DEFAULT_SETTINGS.eyeSeparation,
      trackingSensitivity: store.DEFAULT_SETTINGS.trackingSensitivity,
    });
  });

  it('resets to the defaults and saves them', () => {
    const { store, disk } = launch();
    store.setEyeSeparation(3);
    store.setMode('mono');

    store.resetSettings();

    expect(store.getSettings()).toEqual(store.DEFAULT_SETTINGS);
    expect(JSON.parse(disk.getString('settings') ?? 'null').state).toEqual(store.DEFAULT_SETTINGS);
  });

  // Uses the app's own module instance: an isolated copy would bring its own React.
  it('re-renders hook consumers when a setting changes', () => {
    const { result } = renderHook(() => ({
      all: useSettings(),
      intensity: useSetting('miniatureIntensity'),
    }));

    act(() => setMiniatureIntensity(0.9));

    expect(result.current.intensity).toBe(0.9);
    expect(result.current.all.miniatureIntensity).toBe(0.9);
    act(() => resetSettings());
  });

  it('re-renders a useSetting consumer only when its own setting changes', () => {
    let renders = 0;
    const { result } = renderHook(() => {
      renders += 1;
      return useSetting('mode');
    });
    const initialRenders = renders;

    act(() => setEyeSeparation(2));
    expect(renders).toBe(initialRenders);

    act(() => setMode('mono'));
    expect(renders).toBeGreaterThan(initialRenders);
    expect(result.current).toBe('mono');
    act(() => resetSettings());
  });
});
