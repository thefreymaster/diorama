import { act, renderHook } from '@testing-library/react-native';

import { DEFAULT_LENS_SPACING, DEFAULT_WINDOW_DIAMETER } from '@diorama/native';

import {
  resetSettings,
  setEyeSeparation,
  setMiniatureIntensity,
  setTwoEyeLandscape,
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
      cameraHeight: 1.0,
      trackingSensitivity: 1.0,
      miniatureIntensity: 0.6,
      twoEyeLandscape: true,
      debugLook: false,
      lensSpacing: 64,
      windowDiameter: 35,
    });
  });

  it("fits the viewer the way the native view does when it's told nothing", () => {
    const { store } = launch();

    expect(store.getSettings()).toMatchObject({
      lensSpacing: DEFAULT_LENS_SPACING,
      windowDiameter: DEFAULT_WINDOW_DIAMETER,
    });
  });

  it('persists changes to MMKV', () => {
    const { store, disk } = launch();

    store.setEyeSeparation(2);
    store.setCameraHeight(0.5);
    store.setTwoEyeLandscape(false);

    const saved = JSON.parse(disk.getString('settings') ?? 'null');
    expect(saved.state).toMatchObject({
      eyeSeparation: 2,
      cameraHeight: 0.5,
      twoEyeLandscape: false,
    });
  });

  it('rehydrates the saved settings on the next launch', () => {
    const first = launch();
    first.store.setEyeSeparation(2.5);
    first.store.setCameraHeight(2);
    first.store.setTrackingSensitivity(1.5);
    first.store.setMiniatureIntensity(0.2);
    first.store.setTwoEyeLandscape(false);
    first.store.setDebugLook(true);
    first.store.setLensSpacing(62);
    first.store.setWindowDiameter(38);
    const saved = first.disk.getString('settings');

    const second = launch(saved);

    expect(second.store.getSettings()).toEqual({
      eyeSeparation: 2.5,
      cameraHeight: 2,
      trackingSensitivity: 1.5,
      miniatureIntensity: 0.2,
      twoEyeLandscape: false,
      debugLook: true,
      lensSpacing: 62,
      windowDiameter: 38,
    });
  });

  it('keeps settings saved before the viewer fit existed, and fits the viewer by default', () => {
    // What a build before T24 saved: version 1, no viewer fit.
    const saved = JSON.stringify({
      state: {
        eyeSeparation: 2,
        trackingSensitivity: 0.8,
        miniatureIntensity: 0.3,
        mode: 'mono',
        debugLook: false,
      },
      version: 1,
    });

    const { store, disk } = launch(saved);

    expect(store.getSettings()).toEqual({
      eyeSeparation: 2,
      cameraHeight: 1,
      trackingSensitivity: 0.8,
      miniatureIntensity: 0.3,
      twoEyeLandscape: false,
      debugLook: false,
      lensSpacing: 64,
      windowDiameter: 35,
    });

    // The next change saves the whole set, viewer fit included.
    store.setWindowDiameter(40);
    expect(JSON.parse(disk.getString('settings') ?? 'null').state).toMatchObject({
      eyeSeparation: 2,
      lensSpacing: 64,
      windowDiameter: 40,
    });
  });

  it('drops the window width and height saved before the windows were round', () => {
    // What a T24 build saved: version 1, a rectangular window.
    const saved = JSON.stringify({
      state: {
        eyeSeparation: 1.5,
        trackingSensitivity: 1.2,
        miniatureIntensity: 0.4,
        mode: 'stereo',
        debugLook: false,
        lensSpacing: 62,
        windowWidth: 31,
        windowHeight: 48,
      },
      version: 1,
    });

    const { store, disk } = launch(saved);

    // Everything else carries over; the circle starts at the default size.
    expect(store.getSettings()).toEqual({
      eyeSeparation: 1.5,
      cameraHeight: 1,
      trackingSensitivity: 1.2,
      miniatureIntensity: 0.4,
      twoEyeLandscape: true,
      debugLook: false,
      lensSpacing: 62,
      windowDiameter: 35,
    });
    expect(store.getSettings()).not.toHaveProperty('windowWidth');
    expect(store.getSettings()).not.toHaveProperty('windowHeight');

    // The next save leaves the old keys behind for good.
    store.setTwoEyeLandscape(false);
    const rewritten = JSON.parse(disk.getString('settings') ?? 'null');
    expect(rewritten).toEqual({
      state: {
        eyeSeparation: 1.5,
        cameraHeight: 1,
        trackingSensitivity: 1.2,
        miniatureIntensity: 0.4,
        twoEyeLandscape: false,
        debugLook: false,
        lensSpacing: 62,
        windowDiameter: 35,
      },
      version: 1,
    });

    // And the launch after that reads it back the same.
    expect(launch(JSON.stringify(rewritten)).store.getSettings()).toEqual(rewritten.state);
  });

  it('keeps a saved diameter alongside leftover window sizes', () => {
    const saved = JSON.stringify({
      state: { windowDiameter: 41, windowWidth: 33, windowHeight: 42 },
      version: 1,
    });

    const { store } = launch(saved);

    expect(store.getSettings().windowDiameter).toBe(41);
    expect(store.getSettings()).not.toHaveProperty('windowHeight');
  });

  it('ignores invalid values on disk', () => {
    const saved = JSON.stringify({
      state: {
        eyeSeparation: 'big',
        cameraHeight: '2x',
        twoEyeLandscape: 'sideways',
        mode: 'hologram',
        miniatureIntensity: 7,
        debugLook: true,
        lensSpacing: '64 mm',
        windowDiameter: null,
      },
      version: 1,
    });

    const { store } = launch(saved);

    expect(store.getSettings()).toEqual({
      eyeSeparation: 1.0,
      cameraHeight: 1.0,
      trackingSensitivity: 1.0,
      miniatureIntensity: 1,
      twoEyeLandscape: true,
      debugLook: true,
      lensSpacing: 64,
      windowDiameter: 35,
    });
  });

  describe('the old Stereo switch', () => {
    /** What a build before T32 saved: version 1, with the Stereo switch as `mode`. */
    function savedWithMode(mode?: unknown) {
      return JSON.stringify({
        state: { eyeSeparation: 1.4, miniatureIntensity: 0.5, debugLook: false, mode },
        version: 1,
      });
    }

    it('turns "Two-eye view in landscape" off when mono was chosen', () => {
      const { store } = launch(savedWithMode('mono'));

      expect(store.getSettings()).toMatchObject({
        eyeSeparation: 1.4,
        miniatureIntensity: 0.5,
        twoEyeLandscape: false,
      });
      expect(store.getSettings()).not.toHaveProperty('mode');
    });

    it('leaves it on when stereo was chosen, or nothing, or nonsense', () => {
      expect(launch(savedWithMode('stereo')).store.getSettings().twoEyeLandscape).toBe(true);
      expect(launch(savedWithMode()).store.getSettings().twoEyeLandscape).toBe(true);
      expect(launch(savedWithMode('hologram')).store.getSettings().twoEyeLandscape).toBe(true);
      expect(launch(savedWithMode(false)).store.getSettings().twoEyeLandscape).toBe(true);
    });

    it('leaves the old key behind with the next save, keeping the choice', () => {
      const first = launch(savedWithMode('mono'));

      first.store.setEyeSeparation(2);
      const rewritten = JSON.parse(first.disk.getString('settings') ?? 'null');
      expect(rewritten.state).toMatchObject({ eyeSeparation: 2, twoEyeLandscape: false });
      expect(rewritten.state).not.toHaveProperty('mode');
      expect(rewritten.version).toBe(1);

      // And the launch after that reads it back the same.
      const second = launch(JSON.stringify(rewritten));
      expect(second.store.getSettings()).toMatchObject({
        eyeSeparation: 2,
        twoEyeLandscape: false,
      });
    });

    it('goes by the new setting when both are on disk', () => {
      const saved = JSON.stringify({
        state: { twoEyeLandscape: true, mode: 'mono' },
        version: 1,
      });

      expect(launch(saved).store.getSettings().twoEyeLandscape).toBe(true);
    });

    it('falls back to the old switch when the new setting on disk is invalid', () => {
      const saved = JSON.stringify({
        state: { twoEyeLandscape: 'off', mode: 'mono' },
        version: 1,
      });

      expect(launch(saved).store.getSettings().twoEyeLandscape).toBe(false);
    });
  });

  it('turns the two-eye view on and off', () => {
    const { store } = launch();

    store.setTwoEyeLandscape(false);
    expect(store.getSettings().twoEyeLandscape).toBe(false);
    store.setTwoEyeLandscape(true);
    expect(store.getSettings().twoEyeLandscape).toBe(true);
  });

  it('clamps out-of-range values on disk instead of dropping them', () => {
    const saved = JSON.stringify({
      state: {
        eyeSeparation: -5,
        cameraHeight: 12,
        trackingSensitivity: 100,
        miniatureIntensity: 0.4,
        lensSpacing: 90,
        windowDiameter: 10,
      },
      version: 1,
    });

    const { store } = launch(saved);

    expect(store.getSettings()).toMatchObject({
      eyeSeparation: store.SETTING_RANGES.eyeSeparation.min,
      cameraHeight: 3,
      trackingSensitivity: store.SETTING_RANGES.trackingSensitivity.max,
      miniatureIntensity: 0.4,
      lensSpacing: 72,
      windowDiameter: 25,
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

    store.setTwoEyeLandscape(false);

    const saved = JSON.parse(disk.getString('settings') ?? 'null');
    expect(saved).toEqual({
      state: { ...store.DEFAULT_SETTINGS, twoEyeLandscape: false },
      version: 1,
    });
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

  it('keeps the viewer fit in range: 55-72 mm apart, circles 25-45 mm across', () => {
    const { store } = launch();

    store.setLensSpacing(40);
    store.setWindowDiameter(34);
    expect(store.getSettings()).toMatchObject({ lensSpacing: 55, windowDiameter: 34 });

    store.setLensSpacing(100);
    store.setWindowDiameter(80);
    expect(store.getSettings()).toMatchObject({ lensSpacing: 72, windowDiameter: 45 });

    store.setWindowDiameter(0);
    expect(store.getSettings().windowDiameter).toBe(25);
    store.setWindowDiameter(Number.NaN);
    expect(store.getSettings().windowDiameter).toBe(35);
  });

  it("gives saves from before camera height the city's own height (1×), keeping the rest", () => {
    // What a T26 build saved: version 1, round windows, no camera height.
    const saved = JSON.stringify({
      state: {
        eyeSeparation: 0.8,
        trackingSensitivity: 1.3,
        miniatureIntensity: 0.5,
        mode: 'stereo',
        debugLook: false,
        lensSpacing: 63,
        windowDiameter: 36,
      },
      version: 1,
    });

    const { store, disk } = launch(saved);

    expect(store.getSettings()).toEqual({
      eyeSeparation: 0.8,
      cameraHeight: 1,
      trackingSensitivity: 1.3,
      miniatureIntensity: 0.5,
      twoEyeLandscape: true,
      debugLook: false,
      lensSpacing: 63,
      windowDiameter: 36,
    });

    // The next change saves the height too, and the launch after that keeps it.
    store.setCameraHeight(2.5);
    const rewritten = disk.getString('settings');
    expect(JSON.parse(rewritten ?? 'null').state).toMatchObject({
      cameraHeight: 2.5,
      windowDiameter: 36,
    });
    expect(launch(rewritten).store.getSettings()).toMatchObject({
      eyeSeparation: 0.8,
      cameraHeight: 2.5,
    });
  });

  it('keeps camera height between 0.4× and 3×', () => {
    const { store } = launch();

    store.setCameraHeight(0.5);
    expect(store.getSettings().cameraHeight).toBe(0.5);
    store.setCameraHeight(0.1);
    expect(store.getSettings().cameraHeight).toBe(0.4);
    store.setCameraHeight(8);
    expect(store.getSettings().cameraHeight).toBe(3);
    store.setCameraHeight(-1);
    expect(store.getSettings().cameraHeight).toBe(0.4);
    store.setCameraHeight(Number.NaN);
    expect(store.getSettings().cameraHeight).toBe(1);
    store.setCameraHeight(Number.POSITIVE_INFINITY);
    expect(store.getSettings().cameraHeight).toBe(1);
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
    store.setCameraHeight(0.4);
    store.setTwoEyeLandscape(false);
    store.setLensSpacing(60);
    store.setWindowDiameter(30);

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
      return useSetting('twoEyeLandscape');
    });
    const initialRenders = renders;

    act(() => setEyeSeparation(2));
    expect(renders).toBe(initialRenders);

    act(() => setTwoEyeLandscape(false));
    expect(renders).toBeGreaterThan(initialRenders);
    expect(result.current).toBe(false);
    act(() => resetSettings());
  });
});
