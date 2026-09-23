import { GlassView } from 'expo-glass-effect';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import {
  act,
  fireEvent,
  renderRouter,
  screen,
  testRouter,
  within,
} from 'expo-router/testing-library';
import {
  AccessibilityInfo,
  AppState,
  StatusBar,
  StyleSheet,
  type AppStateStatus,
} from 'react-native';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import { getAnimatedStyle } from 'react-native-reanimated';

import type { DioramaMapViewProps, DioramaRect, DioramaStereoEyes } from '@diorama/native';
import {
  resetSettings,
  setDebugLook,
  setEyeSeparation,
  setMiniatureIntensity,
  setMode,
  setTrackingSensitivity,
} from '@/features/settings/store';
import { COUNTDOWN_HINT, COUNTDOWN_TITLE, HUD_NOTICES } from '@/features/viewer/hud';
import { EXIT_BUTTON_SHOWN_MS } from '@/features/viewer/useExitButton';
import { queryClient } from '@/providers/queryClient';
import { canUseLiquidGlass } from '@/ui/liquidGlass';

import * as CityRoute from '../../../../app/city/[cityId]';
import * as IndexRoute from '../../../../app/index';
import * as RootLayout from '../../../../app/_layout';
import * as SettingsRoute from '../../../../app/settings';
import * as ViewerRoute from '../../../../app/view/[cityId]';
import { EXIT_HOLD_DRIFT, EXIT_HOLD_MS, VIEWER_ACCESSIBILITY_HINT } from '../ViewerGestures';

const mockRecenter = jest.fn(() => Promise.resolve());
// Where the native view says each eye's window is; `null` until it has.
let mockStereoEyes: DioramaStereoEyes | null = null;
// Taken before each test swaps in fake timers.
const realSetImmediate = setImmediate;

// The native map becomes a plain view that keeps its props (so tests can read
// them and play MapKit's part by calling `onReady`) and a ref with `recenter`.
jest.mock('@diorama/native', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  function MockDioramaMapView({ ref, ...props }: DioramaMapViewProps) {
    React.useImperativeHandle(ref, () => ({
      recenter: mockRecenter,
      setDebugLook: () => Promise.resolve(),
    }));
    return React.createElement(View, { testID: 'diorama-map', ...props });
  }
  return {
    ...jest.requireActual<object>('@diorama/native'),
    DioramaMapView: MockDioramaMapView,
    useStereoEyes: () => mockStereoEyes,
  };
});

jest.mock('expo-haptics', () => ({
  ...jest.requireActual<object>('expo-haptics'),
  impactAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('expo-keep-awake', () => ({ useKeepAwake: jest.fn() }));

// iOS 26 (Liquid Glass) unless a test says otherwise.
jest.mock('@/ui/liquidGlass', () => ({ canUseLiquidGlass: jest.fn(() => true) }));

const mockImpact = jest.mocked(Haptics.impactAsync);
const mockLiquidGlass = jest.mocked(canUseLiquidGlass);

const routes = {
  _layout: RootLayout,
  index: IndexRoute,
  'city/[cityId]': CityRoute,
  'view/[cityId]': ViewerRoute,
  settings: SettingsRoute,
};

const RECENTERED = HUD_NOTICES.recentered.text;
const COOLING = HUD_NOTICES.cooling.text;
// The HUD is hidden from VoiceOver (it announces itself), so look past that.
const HIDDEN = { includeHiddenElements: true };
const EXIT = { name: 'Exit' };

// T24's default windows on an iPhone 14 Pro in landscape (852 × 393 pt).
const EYES: DioramaStereoEyes = {
  left: { x: 133.33, y: 70, width: 199, height: 253 },
  right: { x: 519.67, y: 70, width: 199, height: 253 },
};

type HudLook = { opacity: number; transform: unknown };

let appStateListeners: ((state: AppStateStatus) => void)[] = [];

beforeEach(() => {
  jest.useFakeTimers();
  queryClient.clear();
  resetSettings();
  mockRecenter.mockClear();
  mockImpact.mockClear();
  mockLiquidGlass.mockReturnValue(true);
  mockStereoEyes = null;
  appStateListeners = [];
  const addEventListener = (event: string, listener: (state: AppStateStatus) => void) => {
    if (event === 'change') appStateListeners.push(listener);
    return { remove: () => (appStateListeners = appStateListeners.filter((l) => l !== listener)) };
  };
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation(addEventListener as unknown as typeof AppState.addEventListener);
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

/** The Viewer's map props. */
function viewerMap(): DioramaMapViewProps {
  return screen.getByTestId('viewer-map').props as DioramaMapViewProps;
}

async function openViewer(url = '/view/paris') {
  const router = renderRouter(routes, { initialUrl: url });
  await screen.findByTestId('viewer-map');
  return router;
}

/** What the native view reports once both eyes have drawn. */
function finishLoading() {
  act(() => viewerMap().onReady?.({ flyoverAvailable: true }));
}

function wait(ms: number) {
  act(() => jest.advanceTimersByTime(ms));
}

/** Loaded, counted down: the wearer is in the diorama. */
function enterDiorama() {
  finishLoading();
  wait(3000);
}

function setAppState(state: AppStateStatus) {
  act(() => appStateListeners.forEach((listener) => listener(state)));
}

/**
 * Gesture Handler hands a re-rendered gesture its new callbacks on the next
 * turn of the event loop (a real `setImmediate`, which fake timers don't
 * drive), so let that happen before firing it.
 */
async function nextGestureCallbacks() {
  await act(() => new Promise<void>((resolve) => realSetImmediate(resolve)));
}

/** Lets the preview finish mounting (it reads the Reduce Motion setting asynchronously). */
async function landOnPreview() {
  expect(await screen.findByTestId('city-preview-screen')).toBeOnTheScreen();
  await act(async () => {});
}

async function doubleTap() {
  await nextGestureCallbacks();
  act(() => fireGestureHandler(getByGestureTestId('viewer-double-tap')));
}

/** A single tap, once the double-tap window has passed. */
async function tap() {
  await nextGestureCallbacks();
  act(() => fireGestureHandler(getByGestureTestId('viewer-tap')));
}

/** The exit button, while it's up (hidden, VoiceOver can't find it either). */
function exitButton() {
  return screen.queryByRole('button', EXIT);
}

/** Where the exit button is, in screen points. */
function exitFrame(): DioramaRect {
  const { left, top, width, height } = StyleSheet.flatten(
    screen.getByTestId('viewer-exit', HIDDEN).props.style,
  );
  return { x: Number(left), y: Number(top), width: Number(width), height: Number(height) };
}

function overlaps(a: DioramaRect, b: DioramaRect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/**
 * The gestures that must fail before this one may start, by handler tag
 * (the detector turns each relation into its tag when it attaches).
 */
function waitsFor(testId: string): number[] {
  const refs = getByGestureTestId(testId).config.requireToFail ?? [];
  return refs.flatMap((ref) => (typeof ref === 'number' ? [ref] : []));
}

function tagOf(testId: string): number {
  return getByGestureTestId(testId).handlerTag;
}

async function holdToExit() {
  await nextGestureCallbacks();
  // Async, so the preview it lands on can settle inside act.
  await act(async () => fireGestureHandler(getByGestureTestId('viewer-long-press')));
}

describe('viewer', () => {
  it('shows the city from its own camera with Settings applied', async () => {
    await openViewer();

    expect(viewerMap()).toMatchObject({
      center: { latitude: 48.8575, longitude: 2.2957 },
      altitude: 1000,
      pitch: 60,
      heading: 137,
      mode: 'stereo',
      eyeSeparation: 1,
      trackingSensitivity: 1,
      debugLook: false,
    });
    expect(viewerMap().orbit).toBeFalsy();
    // No chrome while it's worn, but a way out.
    expect(screen.getAllByRole('button')).toEqual([screen.getByRole('button', EXIT)]);
  });

  it('hides the status bar and keeps the screen awake', async () => {
    await openViewer();

    expect(screen.UNSAFE_getByType(StatusBar).props.hidden).toBe(true);
    expect(useKeepAwake).toHaveBeenCalled();
  });

  it('counts down only after the city has drawn, then recenters and starts tracking', async () => {
    await openViewer();

    // Still loading behind the black cover: no countdown, however long it takes.
    wait(5000);
    expect(screen.queryAllByText(COUNTDOWN_TITLE, HIDDEN)).toHaveLength(0);
    expect(viewerMap().headTracking).toBe(false);

    finishLoading();
    expect(screen.getAllByText(COUNTDOWN_TITLE, HIDDEN)).not.toHaveLength(0);
    expect(screen.getAllByText('3', HIDDEN)).not.toHaveLength(0);

    wait(1000);
    expect(screen.getAllByText('2', HIDDEN)).not.toHaveLength(0);
    wait(1000);
    expect(screen.getAllByText('1', HIDDEN)).not.toHaveLength(0);
    expect(mockRecenter).not.toHaveBeenCalled();
    expect(viewerMap().headTracking).toBe(false);

    wait(1000);
    expect(mockRecenter).toHaveBeenCalledTimes(1);
    expect(viewerMap().headTracking).toBe(true);

    // A later render report never starts it again.
    finishLoading();
    wait(3000);
    expect(screen.queryAllByText('3', HIDDEN)).toHaveLength(0);
    expect(mockRecenter).toHaveBeenCalledTimes(1);
  });

  it('draws the HUD once per eye in stereo', async () => {
    await openViewer();
    finishLoading();

    expect(screen.getAllByText(COUNTDOWN_TITLE, HIDDEN)).toHaveLength(2);
    const countdown = `3${COUNTDOWN_TITLE}${COUNTDOWN_HINT}`;
    expect(screen.getByTestId('hud-eye-left', HIDDEN)).toHaveTextContent(countdown);
    expect(screen.getByTestId('hud-eye-right', HIDDEN)).toHaveTextContent(countdown);

    wait(3000);
    await doubleTap();
    expect(screen.getAllByText(RECENTERED, HIDDEN)).toHaveLength(2);
  });

  it('draws the HUD once in mono', async () => {
    setMode('mono');
    await openViewer();
    expect(viewerMap().mode).toBe('mono');
    finishLoading();

    expect(screen.getAllByText(COUNTDOWN_TITLE, HIDDEN)).toHaveLength(1);

    wait(3000);
    await doubleTap();
    expect(screen.getAllByText(RECENTERED, HIDDEN)).toHaveLength(1);
  });

  it('materializes the recenter HUD, then dissolves it on its own', async () => {
    // Mono: under Jest, Reanimated only tracks one view per animated style
    // (on a phone both eye copies follow it).
    setMode('mono');
    await openViewer();
    enterDiorama();
    wait(1000);
    const look = (testID: string) =>
      getAnimatedStyle(screen.getByTestId(testID, HIDDEN)) as HudLook;
    const glass = () =>
      within(screen.getByTestId('viewer-hud', HIDDEN)).UNSAFE_getByType(GlassView).props
        .glassEffectStyle;
    expect(glass()).toMatchObject({ style: 'none', animate: true });

    await doubleTap();
    wait(800);
    // The glass materializes itself and only its words fade: Liquid Glass
    // isn't drawn under a parent that is being faded.
    expect(glass()).toMatchObject({ style: 'regular', animate: true });
    expect(look('viewer-hud-content').opacity).toBeCloseTo(1, 2);
    expect(look('viewer-hud')).toEqual({ opacity: 1, transform: [{ scale: 1 }] });

    wait(HUD_NOTICES.recentered.holdMs);
    wait(1000);
    expect(glass()).toMatchObject({ style: 'none' });
    expect(look('viewer-hud-content').opacity).toBeCloseTo(0, 2);
    expect(look('viewer-hud').opacity).toBe(1);
  });

  it('fades the whole HUD, blur and all, before iOS 26', async () => {
    mockLiquidGlass.mockReturnValue(false);
    setMode('mono');
    await openViewer();
    enterDiorama();
    wait(1000);
    const opacity = () => getAnimatedStyle(screen.getByTestId('viewer-hud', HIDDEN)).opacity;

    await doubleTap();
    wait(800);
    expect(opacity()).toBeCloseTo(1, 2);

    wait(HUD_NOTICES.recentered.holdMs);
    wait(1000);
    expect(opacity()).toBeCloseTo(0, 2);
  });

  it('only dissolves the HUD under Reduce Motion, with no overshoot', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    setMode('mono');
    await openViewer();
    enterDiorama();
    wait(1000);

    await doubleTap();
    const frames: { opacity: number; scale: unknown }[] = [];
    for (let elapsed = 0; elapsed < 800; elapsed += 16) {
      wait(16);
      const container = getAnimatedStyle(screen.getByTestId('viewer-hud', HIDDEN)) as HudLook;
      const content = getAnimatedStyle(screen.getByTestId('viewer-hud-content', HIDDEN));
      frames.push({ opacity: content.opacity as number, scale: container.transform });
    }

    // A fade, not a pop, that never grows and never flickers past fully shown.
    expect(frames[0]?.opacity).toBeGreaterThan(0);
    expect(frames[0]?.opacity).toBeLessThan(1);
    frames.forEach(({ opacity, scale }, index) => {
      expect(scale).toEqual([{ scale: 1 }]);
      expect(opacity).toBeLessThanOrEqual(1);
      if (index > 0) expect(opacity).toBeGreaterThanOrEqual(frames[index - 1]!.opacity);
    });
    expect(frames.at(-1)?.opacity).toBeCloseTo(1, 2);
  });

  it('says so when the phone gets too hot for stereo, and leaves the fallback alone', async () => {
    await openViewer();
    enterDiorama();

    act(() => viewerMap().onDegraded?.({ reason: 'thermal' }));

    // The native view went mono on its own, so the HUD is drawn once.
    expect(screen.getAllByText(COOLING, HIDDEN)).toHaveLength(1);
    expect(viewerMap().mode).toBe('stereo');
  });

  it('recenters on a double-tap, with a tap and a brief HUD', async () => {
    await openViewer();
    finishLoading();

    // Nothing to recenter until the countdown has.
    await doubleTap();
    expect(mockRecenter).not.toHaveBeenCalled();

    wait(3000);
    mockRecenter.mockClear();
    await doubleTap();

    expect(getByGestureTestId('viewer-double-tap').config).toMatchObject({ numberOfTaps: 2 });
    expect(mockRecenter).toHaveBeenCalledTimes(1);
    expect(mockImpact).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
    expect(screen.getAllByText(RECENTERED, HIDDEN)).not.toHaveLength(0);
  });

  it('goes back to the preview underneath on a one-second hold', async () => {
    const router = renderRouter(routes, { initialUrl: '/city/paris' });
    fireEvent.press(await screen.findByRole('button', { name: 'Enter Diorama' }));
    await screen.findByTestId('viewer-map');
    mockImpact.mockClear();

    // A second, and a finger may drift a little (in the hand or a headset).
    expect(getByGestureTestId('viewer-long-press').config).toMatchObject({
      minDurationMs: EXIT_HOLD_MS,
      maxDist: EXIT_HOLD_DRIFT,
    });
    expect(EXIT_HOLD_MS).toBe(1000);
    expect(EXIT_HOLD_DRIFT).toBe(30);
    await holdToExit();

    expect(mockImpact).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium);
    expect(router.getPathname()).toBe('/city/paris');
    expect(screen.queryByTestId('viewer-screen')).toBeNull();
    await landOnPreview();
    // The picker is still under the preview.
    act(() => testRouter.back());
    expect(router.getPathname()).toBe('/');
  });

  it('opens the preview in its place when it was opened from a link', async () => {
    const router = await openViewer('/view/paris');

    await holdToExit();

    expect(router.getPathname()).toBe('/city/paris');
    await landOnPreview();
    expect(screen.queryByTestId('viewer-screen')).toBeNull();
    act(() => testRouter.back());
    expect(router.getPathname()).toBe('/');
    expect(await screen.findByTestId('city-picker-screen')).toBeOnTheScreen();
  });

  it('turns head tracking off while the app is in the background, and recenters on return', async () => {
    await openViewer();
    enterDiorama();
    expect(viewerMap().headTracking).toBe(true);
    mockRecenter.mockClear();

    setAppState('inactive');
    expect(viewerMap().headTracking).toBe(false);
    setAppState('background');
    expect(viewerMap().headTracking).toBe(false);
    expect(mockRecenter).not.toHaveBeenCalled();

    setAppState('active');
    expect(viewerMap().headTracking).toBe(true);
    expect(mockRecenter).toHaveBeenCalledTimes(1);
  });

  it('lets VoiceOver recenter and exit', async () => {
    const router = await openViewer();
    enterDiorama();
    mockRecenter.mockClear();
    const view = screen.getByTestId('viewer-screen');
    expect(view).toHaveAccessibleName('3D view of Paris');
    expect(view.props.accessibilityHint).toBe(VIEWER_ACCESSIBILITY_HINT);
    // The rotor lists Recenter and Exit.
    expect(view.props.accessibilityActions).toEqual(
      expect.arrayContaining([
        { name: 'recenter', label: 'Recenter' },
        { name: 'exit', label: 'Exit' },
      ]),
    );

    fireEvent(view, 'accessibilityAction', { nativeEvent: { actionName: 'activate' } });
    expect(mockRecenter).toHaveBeenCalledTimes(1);

    await act(async () =>
      fireEvent(view, 'accessibilityAction', { nativeEvent: { actionName: 'exit' } }),
    );
    expect(router.getPathname()).toBe('/city/paris');
    await landOnPreview();
  });

  it('follows Settings changes while it is open', async () => {
    await openViewer();
    enterDiorama();
    expect(screen.getAllByTestId(/hud-eye-/, HIDDEN)).toHaveLength(2);

    act(() => {
      setEyeSeparation(2);
      setTrackingSensitivity(1.5);
      setMiniatureIntensity(0.2);
      setMode('mono');
      setDebugLook(true);
    });

    expect(viewerMap()).toMatchObject({
      mode: 'mono',
      eyeSeparation: 2,
      trackingSensitivity: 1.5,
      miniatureIntensity: 0.2,
      debugLook: true,
    });
    // The HUD follows too: one copy in mono.
    await doubleTap();
    expect(screen.getAllByText(RECENTERED, HIDDEN)).toHaveLength(1);
  });

  it('quietly goes back to the city list for a city it does not know', async () => {
    const router = renderRouter(routes, { initialUrl: '/view/atlantis' });

    expect(await screen.findByTestId('city-picker-screen')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/');
    expect(screen.queryByTestId('viewer-map')).toBeNull();
  });
});

describe('viewer exit button', () => {
  it('stays up in stereo, in the black outside both eye windows', async () => {
    mockStereoEyes = EYES;
    await openViewer();

    expect(exitButton()).toBeOnTheScreen();
    const frame = exitFrame();
    expect(frame.width).toBeGreaterThanOrEqual(44);
    expect(frame.height).toBeGreaterThanOrEqual(44);
    expect(overlaps(frame, EYES.left)).toBe(false);
    expect(overlaps(frame, EYES.right)).toBe(false);

    // Still there with the viewer on, however long it's worn.
    enterDiorama();
    await tap();
    wait(EXIT_BUTTON_SHOWN_MS * 2);
    expect(exitButton()).toBeOnTheScreen();
  });

  it('sits in the top-left corner until the map reports its windows', async () => {
    await openViewer();

    expect(exitButton()).toBeOnTheScreen();
    expect(exitFrame()).toMatchObject({ x: 16, y: 16 });
  });

  it('goes back to the preview when pressed, with a firm tap', async () => {
    mockStereoEyes = EYES;
    const router = await openViewer('/view/paris');
    mockImpact.mockClear();

    await act(async () => fireEvent.press(screen.getByRole('button', EXIT)));

    expect(mockImpact).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium);
    expect(router.getPathname()).toBe('/city/paris');
    await landOnPreview();
    expect(screen.queryByTestId('viewer-screen')).toBeNull();
    // Opened from a link, the picker is still under the preview.
    act(() => testRouter.back());
    expect(router.getPathname()).toBe('/');
    expect(await screen.findByTestId('city-picker-screen')).toBeOnTheScreen();
  });

  it('waits for a tap in mono, then fades out 3 s later', async () => {
    setMode('mono');
    await openViewer();
    enterDiorama();
    const glyph = () => getAnimatedStyle(screen.getByTestId('viewer-exit-glyph', HIDDEN)).opacity;
    const takesTouches = () =>
      StyleSheet.flatten(screen.getByTestId('viewer-exit', HIDDEN).props.style).pointerEvents;

    expect(exitButton()).toBeNull();
    expect(glyph()).toBe(0);
    expect(takesTouches()).toBe('none');

    await tap();
    wait(800);
    expect(exitButton()).toBeOnTheScreen();
    expect(glyph()).toBeCloseTo(1, 2);
    expect(takesTouches()).toBe('auto');

    // Another tap keeps it up for 3 s more.
    await tap();
    wait(EXIT_BUTTON_SHOWN_MS - 1);
    expect(exitButton()).toBeOnTheScreen();
    wait(1);
    expect(exitButton()).toBeNull();
    expect(takesTouches()).toBe('none');
    wait(1000);
    expect(glyph()).toBeCloseTo(0, 2);
  });

  it('exits from mono too, once a tap has shown it', async () => {
    setMode('mono');
    const router = await openViewer();
    enterDiorama();

    await tap();
    await act(async () => fireEvent.press(screen.getByRole('button', EXIT)));

    expect(router.getPathname()).toBe('/city/paris');
    await landOnPreview();
  });

  it('never slows or blocks a double-tap recenter', async () => {
    setMode('mono');
    await openViewer();
    enterDiorama();
    mockRecenter.mockClear();

    await doubleTap();

    expect(mockRecenter).toHaveBeenCalledTimes(1);
    expect(exitButton()).toBeNull();
    // A double-tap wins at once; a single tap waits for it to fail, and a
    // hold waits for both.
    expect(waitsFor('viewer-double-tap')).toEqual([]);
    expect(waitsFor('viewer-tap')).toEqual([tagOf('viewer-double-tap')]);
    expect(waitsFor('viewer-long-press')).toEqual([
      tagOf('viewer-double-tap'),
      tagOf('viewer-tap'),
    ]);
  });

  it('only fades under Reduce Motion, with no scale', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    setMode('mono');
    await openViewer();
    enterDiorama();

    await tap();
    const frames: { opacity: number; transform: unknown }[] = [];
    for (let elapsed = 0; elapsed < 800; elapsed += 16) {
      wait(16);
      const container = getAnimatedStyle(screen.getByTestId('viewer-exit', HIDDEN));
      frames.push({ opacity: glyphOpacity(), transform: container.transform });
    }

    expect(frames[0]?.opacity).toBeGreaterThan(0);
    expect(frames[0]?.opacity).toBeLessThan(1);
    frames.forEach(({ opacity, transform }, index) => {
      expect(transform).toEqual([{ scale: 1 }]);
      if (index > 0) expect(opacity).toBeGreaterThanOrEqual(frames[index - 1]!.opacity);
    });
    expect(frames.at(-1)?.opacity).toBeCloseTo(1, 2);
  });

  it('tells you how to exit under the countdown', async () => {
    await openViewer();
    finishLoading();

    // Once per eye.
    expect(screen.getAllByText(COUNTDOWN_HINT, HIDDEN)).toHaveLength(2);
  });
});

function glyphOpacity(): number {
  return getAnimatedStyle(screen.getByTestId('viewer-exit-glyph', HIDDEN)).opacity as number;
}
