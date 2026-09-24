import * as Haptics from 'expo-haptics';
import { act, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';
import { AccessibilityInfo, Dimensions } from 'react-native';

import type { DioramaMapViewProps } from '@diorama/native';
import {
  getHiddenFeatured,
  hideFeatured,
  restoreFeatured,
} from '@/features/cities/hiddenFeaturedStore';
import { addRecent, clearRecents, type RecentCity } from '@/features/cities/recentsStore';
import {
  DEFAULT_SETTINGS,
  getSettings,
  resetSettings,
  setCameraHeight,
  setDebugLook,
  setEyeSeparation,
  setLensSpacing,
  setMiniatureIntensity,
  setTrackingSensitivity,
  setTwoEyeLandscape,
  setWindowDiameter,
} from '@/features/settings/store';
import { queryClient } from '@/providers/queryClient';
import { storage } from '@/providers/storage';

import * as CityRoute from '../../../../app/city/[cityId]';
import * as IndexRoute from '../../../../app/index';
import * as RootLayout from '../../../../app/_layout';
import * as SettingsRoute from '../../../../app/settings';
import * as ViewerRoute from '../../../../app/view/[cityId]';
import { SLIDER_SETTINGS, type FitSetting, type SliderSetting } from '../sliderSettings';

// The native map becomes a plain view that keeps its props (so tests can read
// them and play MapKit's part by calling `onReady`) and a ref for the Viewer.
jest.mock('@diorama/native', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  function MockDioramaMapView({ ref, ...props }: DioramaMapViewProps) {
    React.useImperativeHandle(ref, () => ({
      recenter: () => Promise.resolve(),
      setDebugLook: () => Promise.resolve(),
    }));
    return React.createElement(View, { testID: 'diorama-map', ...props });
  }
  return { ...jest.requireActual<object>('@diorama/native'), DioramaMapView: MockDioramaMapView };
});

jest.mock('expo-haptics', () => ({
  ...jest.requireActual<object>('expo-haptics'),
  impactAsync: jest.fn(() => Promise.resolve()),
}));

const mockImpact = jest.mocked(Haptics.impactAsync);

const routes = {
  _layout: RootLayout,
  index: IndexRoute,
  'city/[cityId]': CityRoute,
  'view/[cityId]': ViewerRoute,
  settings: SettingsRoute,
};

// A searched city: flat imagery, so the preview passes over it.
const REYKJAVIK: RecentCity = {
  id: 'reykjavik_64.146_-21.943',
  name: 'Reykjavík',
  country: 'Iceland',
  lat: 64.1466,
  lon: -21.9426,
  altitude: 1500,
};

const PARIS: RecentCity = {
  id: 'paris',
  name: 'Paris',
  country: 'France',
  lat: 48.8575,
  lon: 2.2957,
  altitude: 1000,
};

/** The native stack's header settings for one screen (react-native-screens). */
const HEADER_CONFIG: string = 'RNSScreenStackHeaderConfig';

const TWO_EYE = { name: 'Two-eye view in landscape' };
const TWO_EYE_FOOTER =
  'Shows a picture for each eye when your iPhone is sideways, for a headset viewer. Upright, the city always fills the screen.';

// Jest's window is upright; the Viewer's two-eye view is the sideways one.
const UPRIGHT = Dimensions.get('window');

/** Turns the phone: the window takes on its new shape. */
function holdPhone(orientation: 'sideways' | 'upright') {
  const [short, long] = [UPRIGHT.width, UPRIGHT.height].sort((a, b) => a - b);
  const size =
    orientation === 'sideways' ? { width: long, height: short } : { width: short, height: long };
  const window = { ...Dimensions.get('window'), ...size };
  act(() => Dimensions.set({ window, screen: window }));
}

/** RN types `__DEV__` as a constant; under Jest it's a plain global, so a test can flip it. */
function setDevBuild(isDev: boolean) {
  Reflect.set(globalThis, '__DEV__', isDev);
}

let reduceMotionListener: ((enabled: boolean) => void) | undefined;

beforeEach(() => {
  queryClient.clear();
  clearRecents();
  restoreFeatured();
  resetSettings();
  mockImpact.mockClear();
  reduceMotionListener = undefined;
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  // Keep the Reduce Motion listener, so a test can flip the setting live.
  const addEventListener = (event: string, listener: (enabled: boolean) => void) => {
    if (event === 'reduceMotionChanged') reduceMotionListener = listener;
    return { remove: jest.fn() };
  };
  jest
    .spyOn(AccessibilityInfo, 'addEventListener')
    .mockImplementation(addEventListener as unknown as typeof AccessibilityInfo.addEventListener);
});

afterEach(() => {
  holdPhone('upright');
  jest.restoreAllMocks();
});

async function openSettings() {
  const router = renderRouter(routes, { initialUrl: '/settings' });
  await screen.findByTestId('settings-screen');
  // Let the Reduce Motion check settle.
  await act(async () => {});
  return router;
}

function previewMap(): DioramaMapViewProps {
  return screen.getByTestId('settings-preview-map').props as DioramaMapViewProps;
}

function slider(setting: SliderSetting) {
  return screen.getByTestId(`${setting}-slider`);
}

/** Where the thumb is. The slider sends 0 to UIKit as "unset", which is its default, 0. */
function sliderPosition(setting: SliderSetting): number {
  return (slider(setting).props.value as number | undefined) ?? 0;
}

/** What a finger on the slider reports as it moves. */
function slideTo(setting: SliderSetting, position: number) {
  fireEvent(slider(setting), 'valueChange', position);
}

/** The size a Viewer fit row shows, e.g. "64 mm". */
function fitValue(setting: FitSetting): string {
  return String(screen.getByTestId(`${setting}-value`).props.children);
}

/** VoiceOver's swipe up (increment) or down (decrement) on a Viewer fit row. */
function adjust(title: string, actionName: 'increment' | 'decrement') {
  fireEvent(screen.getByLabelText(title), 'accessibilityAction', { nativeEvent: { actionName } });
}

function savedSettings() {
  return JSON.parse(storage.getString('settings') ?? 'null').state;
}

describe('settings', () => {
  it('is a large-title list with every control', async () => {
    await openSettings();

    const header = screen.UNSAFE_root.findAll(
      (node) => node.type === HEADER_CONFIG && node.props.title === 'Settings',
    );
    expect(header).toHaveLength(1);
    expect(header[0].props.largeTitle).toBe(true);

    for (const title of [
      'Miniature effect',
      'Model size',
      'Camera height',
      'Tracking sensitivity',
      'Lens spacing',
      'Diameter',
    ]) {
      expect(screen.getByText(title)).toBeOnTheScreen();
      expect(screen.getByLabelText(title)).toBeOnTheScreen();
    }
    expect(
      screen.getByText('How high above the city you are. Higher views look more straight down.'),
    ).toBeOnTheScreen();
    expect(screen.getByText('Viewer fit')).toBeOnTheScreen();
    expect(screen.getByText("Match the circles to your viewer's lenses.")).toBeOnTheScreen();
    // The old rectangular window's sliders are gone.
    expect(screen.queryByText('Window width')).toBeNull();
    expect(screen.queryByText('Window height')).toBeNull();
    expect(screen.getByRole('switch', TWO_EYE)).toBeOnTheScreen();
    expect(screen.getByText(TWO_EYE_FOOTER)).toBeOnTheScreen();
    // The Stereo switch is gone: how the phone is held picks the view.
    expect(screen.queryByRole('switch', { name: 'Stereo' })).toBeNull();
    expect(screen.getByRole('switch', { name: 'Look around by dragging' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Reset to defaults' })).toBeOnTheScreen();
    // Nothing deleted from the picker, so nothing to restore.
    expect(screen.queryByText('Restore suggested places')).toBeNull();
  });

  it('shows what the store holds', async () => {
    setEyeSeparation(0.3);
    setCameraHeight(3);
    setTrackingSensitivity(1);
    setMiniatureIntensity(0.25);
    setTwoEyeLandscape(false);
    setDebugLook(true);
    setLensSpacing(72);
    setWindowDiameter(25);
    await openSettings();

    expect(sliderPosition('lensSpacing')).toBeCloseTo(1);
    expect(sliderPosition('windowDiameter')).toBeCloseTo(0);
    expect(fitValue('lensSpacing')).toBe('72 mm');
    expect(fitValue('windowDiameter')).toBe('25 mm');
    expect(sliderPosition('eyeSeparation')).toBeCloseTo(1);
    expect(sliderPosition('cameraHeight')).toBeCloseTo(1);
    expect(sliderPosition('trackingSensitivity')).toBeCloseTo(0.5);
    expect(sliderPosition('miniatureIntensity')).toBeCloseTo(0.25);
    expect(screen.getByRole('switch', TWO_EYE)).not.toBeChecked();
    expect(screen.getByTestId('two-eye-switch').props.value).toBe(false);
    expect(screen.getByRole('switch', { name: 'Look around by dragging' })).toBeChecked();
    expect(screen.getByTestId('debug-look-switch').props.value).toBe(true);
  });

  it('follows store changes made while it is open', async () => {
    await openSettings();

    act(() => setMiniatureIntensity(0.8));

    expect(sliderPosition('miniatureIntensity')).toBeCloseTo(0.8);
    expect(previewMap().miniatureIntensity).toBe(0.8);
  });

  it('saves each slider move as it happens', async () => {
    await openSettings();

    slideTo('miniatureIntensity', 0.3);
    expect(getSettings().miniatureIntensity).toBeCloseTo(0.3);
    expect(savedSettings().miniatureIntensity).toBeCloseTo(0.3);

    slideTo('trackingSensitivity', 1);
    expect(getSettings().trackingSensitivity).toBeCloseTo(2);

    // Right is a bigger model: the eyes closer together.
    slideTo('eyeSeparation', 1);
    expect(getSettings().eyeSeparation).toBeCloseTo(0.3);
    slideTo('eyeSeparation', 0);
    expect(getSettings().eyeSeparation).toBeCloseTo(3);
    expect(savedSettings().eyeSeparation).toBeCloseTo(3);

    // Right is higher up, left closer to the city.
    slideTo('cameraHeight', 1);
    expect(getSettings().cameraHeight).toBeCloseTo(3);
    slideTo('cameraHeight', 0);
    expect(getSettings().cameraHeight).toBeCloseTo(0.4);
    expect(savedSettings().cameraHeight).toBeCloseTo(0.4);
  });

  it('keeps every value in range, whatever the slider reports', async () => {
    await openSettings();

    slideTo('miniatureIntensity', 1.4);
    slideTo('trackingSensitivity', -0.5);
    slideTo('eyeSeparation', 2);
    slideTo('cameraHeight', 1.5);
    expect(getSettings()).toMatchObject({
      miniatureIntensity: 1,
      trackingSensitivity: 0.5,
      eyeSeparation: 0.3,
      cameraHeight: 3,
    });

    slideTo('miniatureIntensity', -1);
    slideTo('trackingSensitivity', 3);
    slideTo('eyeSeparation', -1);
    slideTo('cameraHeight', -0.2);
    expect(getSettings()).toMatchObject({
      miniatureIntensity: 0,
      trackingSensitivity: 2,
      eyeSeparation: 3,
      cameraHeight: 0.4,
    });
  });

  it('saves the final value when the finger lifts', async () => {
    await openSettings();

    fireEvent(slider('miniatureIntensity'), 'slidingComplete', 0.9);

    expect(getSettings().miniatureIntensity).toBeCloseTo(0.9);
  });

  it('turns the two-eye view in landscape off and on, and saves it', async () => {
    await openSettings();
    const row = screen.getByRole('switch', TWO_EYE);
    expect(row).toBeChecked();

    fireEvent(screen.getByTestId('two-eye-switch'), 'valueChange', false);
    expect(getSettings().twoEyeLandscape).toBe(false);
    expect(row).not.toBeChecked();
    expect(savedSettings().twoEyeLandscape).toBe(false);
    expect(savedSettings()).not.toHaveProperty('mode');

    // VoiceOver: a double-tap anywhere on the row flips it back.
    fireEvent(row, 'accessibilityTap');
    expect(getSettings().twoEyeLandscape).toBe(true);
    expect(row).toBeChecked();
    expect(savedSettings().twoEyeLandscape).toBe(true);
  });

  it('dims model size when the two-eye view is off, where it does nothing', async () => {
    await openSettings();
    expect(slider('eyeSeparation').props.disabled).toBe(false);

    fireEvent(screen.getByTestId('two-eye-switch'), 'valueChange', false);

    expect(slider('eyeSeparation').props.disabled).toBe(true);
    // Mono has a camera too.
    expect(slider('cameraHeight').props.disabled).toBe(false);
    expect(slider('trackingSensitivity').props.disabled).toBe(false);
    expect(slider('miniatureIntensity').props.disabled).toBe(false);

    fireEvent(screen.getByTestId('two-eye-switch'), 'valueChange', true);
    expect(slider('eyeSeparation').props.disabled).toBe(false);
  });

  it('shows the viewer fit in millimeters, the defaults to start with', async () => {
    await openSettings();

    expect(fitValue('lensSpacing')).toBe('64 mm');
    expect(fitValue('windowDiameter')).toBe('35 mm');
    expect(screen.getByLabelText('Lens spacing')).toHaveAccessibilityValue({
      text: '64 millimeters',
    });
    expect(screen.getByRole('adjustable', { name: 'Diameter' })).toHaveAccessibilityValue({
      text: '35 millimeters',
    });
  });

  it('snaps the viewer fit to whole millimeters, saves it and shows it as it moves', async () => {
    await openSettings();

    // 55 to 72 mm: a third of the way is 60.67, so 61.
    slideTo('lensSpacing', 1 / 3);
    expect(getSettings().lensSpacing).toBe(61);
    expect(savedSettings().lensSpacing).toBe(61);
    expect(fitValue('lensSpacing')).toBe('61 mm');

    slideTo('windowDiameter', 0);
    expect(getSettings().windowDiameter).toBe(25);
    fireEvent(slider('windowDiameter'), 'slidingComplete', 1);
    expect(getSettings().windowDiameter).toBe(45);
    expect(fitValue('windowDiameter')).toBe('45 mm');

    // 25 to 45 mm: 0.52 of the way is 35.4, so 35.
    slideTo('windowDiameter', 0.52);
    expect(getSettings().windowDiameter).toBe(35);
    slideTo('windowDiameter', 1.2);
    expect(getSettings().windowDiameter).toBe(45);
    expect(savedSettings()).toMatchObject({ lensSpacing: 61, windowDiameter: 45 });

    // The slider snaps too: one step is one millimeter of its track.
    expect(slider('lensSpacing').props.step).toBeCloseTo(1 / 17);
    expect(slider('windowDiameter').props.step).toBeCloseTo(1 / 20);
  });

  it('moves a viewer fit size a millimeter per VoiceOver swipe, within its range', async () => {
    await openSettings();

    adjust('Diameter', 'increment');
    expect(getSettings().windowDiameter).toBe(36);
    expect(screen.getByLabelText('Diameter')).toHaveAccessibilityValue({
      text: '36 millimeters',
    });

    adjust('Lens spacing', 'decrement');
    adjust('Lens spacing', 'decrement');
    expect(getSettings().lensSpacing).toBe(62);

    act(() => setWindowDiameter(45));
    adjust('Diameter', 'increment');
    expect(getSettings().windowDiameter).toBe(45);
    adjust('Diameter', 'decrement');
    expect(getSettings().windowDiameter).toBe(44);
  });

  it('dims the viewer fit when the two-eye view is off, where there are no windows', async () => {
    await openSettings();
    expect(slider('lensSpacing').props.disabled).toBe(false);

    fireEvent(screen.getByTestId('two-eye-switch'), 'valueChange', false);

    for (const setting of ['lensSpacing', 'windowDiameter'] as const) {
      expect(slider(setting).props.disabled).toBe(true);
    }
    expect(screen.getByLabelText('Lens spacing')).toBeDisabled();
    expect(screen.getByLabelText('Diameter')).toBeDisabled();
    adjust('Lens spacing', 'increment');
    adjust('Diameter', 'increment');
    expect(getSettings()).toMatchObject({ lensSpacing: 64, windowDiameter: 35 });
  });

  it('turns look around by dragging on and off', async () => {
    await openSettings();

    fireEvent(screen.getByTestId('debug-look-switch'), 'valueChange', true);
    expect(getSettings().debugLook).toBe(true);

    fireEvent(screen.getByRole('switch', { name: 'Look around by dragging' }), 'accessibilityTap');
    expect(getSettings().debugLook).toBe(false);
  });

  it('leaves look around by dragging out of release builds', async () => {
    setDevBuild(false);
    try {
      await openSettings();

      expect(screen.queryByText('Look around by dragging')).toBeNull();
      expect(screen.queryByText('Developer')).toBeNull();
      expect(screen.queryByTestId('debug-look-switch')).toBeNull();
      expect(screen.getByRole('switch', TWO_EYE)).toBeOnTheScreen();
    } finally {
      setDevBuild(true);
    }
  });

  it('resets everything at once, with a light tap', async () => {
    await openSettings();
    slideTo('miniatureIntensity', 0.1);
    slideTo('trackingSensitivity', 0.9);
    slideTo('eyeSeparation', 0.2);
    slideTo('cameraHeight', 0.9);
    slideTo('lensSpacing', 0);
    slideTo('windowDiameter', 1);
    fireEvent(screen.getByTestId('two-eye-switch'), 'valueChange', false);
    fireEvent(screen.getByTestId('debug-look-switch'), 'valueChange', true);
    expect(previewMap().altitude).not.toBe(1200);

    fireEvent.press(screen.getByRole('button', { name: 'Reset to defaults' }));

    expect(mockImpact).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
    expect(getSettings()).toEqual(DEFAULT_SETTINGS);
    expect(savedSettings()).toEqual(DEFAULT_SETTINGS);
    expect(sliderPosition('miniatureIntensity')).toBeCloseTo(0.6);
    expect(sliderPosition('trackingSensitivity')).toBeCloseTo(0.5);
    expect(screen.getByRole('switch', TWO_EYE)).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Look around by dragging' })).not.toBeChecked();
    expect(previewMap().miniatureIntensity).toBe(0.6);
    expect(getSettings().cameraHeight).toBe(1);
    expect(savedSettings().cameraHeight).toBe(1);
    expect(sliderPosition('cameraHeight')).toBeCloseTo(0.45, 2);
    expect(previewMap().altitude).toBe(1200);
    expect(fitValue('lensSpacing')).toBe('64 mm');
    expect(fitValue('windowDiameter')).toBe('35 mm');
  });
});

describe('restore suggested places', () => {
  const RESTORE = { name: 'Restore suggested places' };

  /** Whether the picker, still under Settings in the stack (so hidden from VoiceOver), lists a city. */
  function pickerLists(name: string): boolean {
    const picker = screen.getByTestId('city-picker-screen', { includeHiddenElements: true });
    return within(picker).queryByText(name, { includeHiddenElements: true }) !== null;
  }

  it('shows only while a featured city is deleted from the picker', async () => {
    await openSettings();
    expect(screen.queryByRole('button', RESTORE)).toBeNull();

    act(() => hideFeatured('paris'));
    expect(screen.getByRole('button', RESTORE)).toBeOnTheScreen();
    expect(
      screen.getByText('Puts the featured cities you deleted back in the list.'),
    ).toBeOnTheScreen();

    act(() => restoreFeatured());
    expect(screen.queryByRole('button', RESTORE)).toBeNull();
  });

  it('brings them all back with a light tap, and says so', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    hideFeatured('paris');
    hideFeatured('tokyo');
    await openSettings();
    expect(pickerLists('Paris')).toBe(false);

    fireEvent.press(screen.getByRole('button', RESTORE));

    expect(mockImpact).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
    expect(announce).toHaveBeenCalledWith('Suggested places restored');
    expect(getHiddenFeatured()).toEqual([]);
    expect(screen.queryByRole('button', RESTORE)).toBeNull();
    expect(pickerLists('Paris')).toBe(true);
    expect(pickerLists('Tokyo')).toBe(true);
  });

  it('is not part of Reset to defaults, which is for how the view looks', async () => {
    hideFeatured('paris');
    await openSettings();

    fireEvent.press(screen.getByRole('button', { name: 'Reset to defaults' }));

    expect(getHiddenFeatured()).toEqual(['paris']);
    expect(screen.getByRole('button', RESTORE)).toBeOnTheScreen();
  });

  it('leaves the preview on the first featured city even when it is hidden', async () => {
    hideFeatured('new-york');
    await openSettings();

    expect(screen.getByLabelText('Preview of New York')).toBeOnTheScreen();
  });
});

describe('settings preview', () => {
  it('shows the miniature look live, in one picture', async () => {
    await openSettings();
    expect(previewMap().miniatureIntensity).toBe(0.6);

    slideTo('miniatureIntensity', 0);
    expect(previewMap().miniatureIntensity).toBe(0);

    slideTo('miniatureIntensity', 1);
    expect(previewMap().miniatureIntensity).toBe(1);

    expect(previewMap().mode ?? 'mono').toBe('mono');
    expect(previewMap().headTracking).toBeFalsy();
  });

  it('shows the first featured city until you open one', async () => {
    addRecent(REYKJAVIK);
    await openSettings();

    expect(previewMap()).toMatchObject({
      center: { latitude: 40.7549, longitude: -73.984 },
      altitude: 1200,
      pitch: 60,
      heading: 29,
    });
    expect(screen.getByLabelText('Preview of New York')).toBeOnTheScreen();
  });

  it('shows the featured city you opened last', async () => {
    addRecent(PARIS);
    addRecent(REYKJAVIK);
    await openSettings();

    expect(previewMap()).toMatchObject({
      center: { latitude: 48.8575, longitude: 2.2957 },
      heading: 137,
    });
    expect(screen.getByLabelText('Preview of Paris')).toBeOnTheScreen();
  });

  it('moves closer or higher up live with Camera height', async () => {
    await openSettings();
    // New York's own framing: 1,200 m out.
    expect(previewMap().altitude).toBe(1200);

    slideTo('cameraHeight', SLIDER_SETTINGS.cameraHeight.scale.toPosition(0.5));
    expect(previewMap().altitude).toBeCloseTo(600);

    slideTo('cameraHeight', SLIDER_SETTINGS.cameraHeight.scale.toPosition(2));
    expect(previewMap().altitude).toBeCloseTo(2400);

    // Only the distance changes: same place, same framing.
    expect(previewMap()).toMatchObject({
      center: { latitude: 40.7549, longitude: -73.984 },
      pitch: 60,
      heading: 29,
    });
  });

  it('turns slowly, and keeps still under Reduce Motion', async () => {
    await openSettings();
    expect(previewMap().orbit).toBe(true);

    act(() => reduceMotionListener?.(true));
    expect(previewMap().orbit).toBe(false);
  });

  it('keeps still from the start when Reduce Motion is already on', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    await openSettings();

    await waitFor(() => expect(previewMap().orbit).toBe(false));
  });
});

describe('settings in the Viewer', () => {
  it('uses what was set here', async () => {
    await openSettings();
    slideTo('miniatureIntensity', 0.2);
    slideTo('trackingSensitivity', 1);
    fireEvent(screen.getByTestId('two-eye-switch'), 'valueChange', false);
    screen.unmount();

    // Sideways, but with the two-eye view off: one full-screen picture.
    holdPhone('sideways');
    renderRouter(routes, { initialUrl: '/view/paris' });

    const viewerMap = (await screen.findByTestId('viewer-map')).props as DioramaMapViewProps;
    expect(viewerMap.miniatureIntensity).toBeCloseTo(0.2);
    expect(viewerMap.trackingSensitivity).toBeCloseTo(2);
    expect(viewerMap.mode).toBe('mono');
  });

  it('fits the eye circles to the viewer as set here', async () => {
    await openSettings();
    slideTo('lensSpacing', 0);
    slideTo('windowDiameter', 0.2);
    screen.unmount();

    holdPhone('sideways');
    renderRouter(routes, { initialUrl: '/view/paris' });

    const viewerMap = (await screen.findByTestId('viewer-map')).props as DioramaMapViewProps;
    expect(viewerMap).toMatchObject({ mode: 'stereo', lensSpacing: 55, windowDiameter: 29 });
    expect(viewerMap).not.toHaveProperty('windowWidth');
    expect(viewerMap).not.toHaveProperty('windowHeight');
  });

  it('stands the camera at the height set here, in stereo and mono', async () => {
    await openSettings();
    slideTo('cameraHeight', SLIDER_SETTINGS.cameraHeight.scale.toPosition(2));
    screen.unmount();

    holdPhone('sideways');
    renderRouter(routes, { initialUrl: '/view/paris' });

    const viewerMap = () => screen.getByTestId('viewer-map').props as DioramaMapViewProps;
    await screen.findByTestId('viewer-map');
    // Paris is framed from 1,000 m.
    expect(viewerMap()).toMatchObject({ mode: 'stereo', pitch: 60, heading: 137 });
    expect(viewerMap().altitude).toBeCloseTo(2000);

    act(() => setTwoEyeLandscape(false));
    expect(viewerMap().mode).toBe('mono');
    expect(viewerMap().altitude).toBeCloseTo(2000);

    act(() => setTwoEyeLandscape(true));
    holdPhone('upright');
    expect(viewerMap().mode).toBe('mono');
    expect(viewerMap().altitude).toBeCloseTo(2000);
  });

  it('moves the camera live while the Viewer is open, within 300 m to 5 km', async () => {
    renderRouter(routes, { initialUrl: '/view/paris' });
    const viewerMap = () => screen.getByTestId('viewer-map').props as DioramaMapViewProps;
    await screen.findByTestId('viewer-map');
    expect(viewerMap().altitude).toBe(1000);

    act(() => setCameraHeight(0.5));
    expect(viewerMap().altitude).toBe(500);

    act(() => setCameraHeight(3));
    expect(viewerMap().altitude).toBe(3000);

    act(() => resetSettings());
    expect(viewerMap().altitude).toBe(1000);
  });

  it('resizes the circles live while the Viewer is open', async () => {
    renderRouter(routes, { initialUrl: '/view/paris' });
    const viewerMap = () => screen.getByTestId('viewer-map').props as DioramaMapViewProps;
    await screen.findByTestId('viewer-map');
    expect(viewerMap()).toMatchObject({ lensSpacing: 64, windowDiameter: 35 });

    act(() => {
      setLensSpacing(66);
      setWindowDiameter(30);
    });

    expect(viewerMap()).toMatchObject({ lensSpacing: 66, windowDiameter: 30 });
  });
});

describe('settings in the city preview', () => {
  it('orbits from the height set here, and follows it live', async () => {
    setCameraHeight(0.5);
    renderRouter(routes, { initialUrl: '/city/paris' });

    const map = () => screen.getByTestId('diorama-map').props as DioramaMapViewProps;
    await screen.findByTestId('diorama-map');
    expect(map()).toMatchObject({ altitude: 500, pitch: 60, heading: 137 });

    act(() => setCameraHeight(2));
    expect(map().altitude).toBe(2000);
  });
});
