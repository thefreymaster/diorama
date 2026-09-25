import { GlassView } from 'expo-glass-effect';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { router as appRouter } from 'expo-router';
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
  DeviceEventEmitter,
  Dimensions,
  StatusBar,
  StyleSheet,
  type AppStateStatus,
} from 'react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import { getAnimatedStyle } from 'react-native-reanimated';

import type {
  CameraAccess,
  DioramaCompassState,
  DioramaHeadPositionState,
  DioramaMapViewProps,
  DioramaRect,
  DioramaStereoEyes,
  DioramaViewMode,
} from '@diorama/native';
import {
  resetSettings,
  setDebugLook,
  setEyeSeparation,
  setHeadPosition,
  setLeanGain,
  setMiniatureIntensity,
  setTrackingSensitivity,
  setTwoEyeLandscape,
} from '@/features/settings/store';
import { COUNTDOWN_HINT, COUNTDOWN_TITLE, HUD_NOTICES, NOTICE_MIN_MS } from '@/features/viewer/hud';
import { CALIBRATING_HINT_DELAY_MS } from '@/features/viewer/useCompassHint';
import { EXIT_BUTTON_SHOWN_MS } from '@/features/viewer/useExitButton';
import { LIMITED_HINT_DELAY_MS } from '@/features/viewer/useLeanHints';
import { LOOK_DEGREES_PER_POINT } from '@/features/viewer/useLookDrag';
import { ZOOM_STEP } from '@/features/viewer/usePinchZoom';
import { queryClient } from '@/providers/queryClient';
import { canUseLiquidGlass } from '@/ui/liquidGlass';

import * as CityRoute from '../../../../app/city/[cityId]';
import * as IndexRoute from '../../../../app/index';
import * as RootLayout from '../../../../app/_layout';
import * as SettingsRoute from '../../../../app/settings';
import * as ViewerRoute from '../../../../app/view/[cityId]';
import { CAMERA_OFF } from '../../Settings/LeanSection';
import { CIRCLE_MARGIN } from '../useCircleFit';
import { EXIT_HOLD_DRIFT, EXIT_HOLD_MS, VIEWER_ACCESSIBILITY_HINT } from '../ViewerGestures';

const mockRecenter = jest.fn(() => Promise.resolve());
const mockSetDebugLook = jest.fn((_dx: number, _dy: number) => Promise.resolve());
// Pinch to zoom: every call the map gets, in order ('set 2' for setZoom(2)).
let mockZoomCalls: string[] = [];
const mockBeginZoom = jest.fn(() => {
  mockZoomCalls.push('begin');
  return Promise.resolve();
});
const mockSetZoom = jest.fn((scale: number) => {
  mockZoomCalls.push(`set ${scale}`);
  return Promise.resolve();
});
const mockEndZoom = jest.fn(() => {
  mockZoomCalls.push('end');
  return Promise.resolve();
});
const mockResetZoom = jest.fn(() => {
  mockZoomCalls.push('reset');
  return Promise.resolve();
});
// Where the native view says each eye's window is; `null` until it has.
let mockStereoEyes: DioramaStereoEyes | null = null;
// Camera access for lean to move closer: read without asking, and the prompt.
const mockGetCameraAccess = jest.fn<Promise<CameraAccess>, []>();
const mockRequestCameraAccess = jest.fn<Promise<CameraAccess>, []>();
// Taken before each test swaps in fake timers.
const realSetImmediate = setImmediate;

// The native map becomes a plain view that keeps its props (so tests can read
// them and play MapKit's part by calling `onReady`) and a ref with `recenter`,
// `setDebugLook` and the zoom methods. Camera access answers as a test says.
jest.mock('@diorama/native', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  function MockDioramaMapView({ ref, ...props }: DioramaMapViewProps) {
    React.useImperativeHandle(ref, () => ({
      recenter: mockRecenter,
      setDebugLook: mockSetDebugLook,
      beginZoom: mockBeginZoom,
      setZoom: mockSetZoom,
      endZoom: mockEndZoom,
      resetZoom: mockResetZoom,
      followTo: () => Promise.resolve(),
      setDebugLean: () => Promise.resolve(),
    }));
    return React.createElement(View, { testID: 'diorama-map', ...props });
  }
  return {
    ...jest.requireActual<object>('@diorama/native'),
    DioramaMapView: MockDioramaMapView,
    useStereoEyes: () => mockStereoEyes,
    getCameraAccess: () => mockGetCameraAccess(),
    requestCameraAccess: () => mockRequestCameraAccess(),
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
// T26's default 35-mm eye circles there (211.3 pt), as the squares around them.
const CIRCLES: DioramaStereoEyes = {
  left: { x: 127.19, y: 90.86, width: 211.28, height: 211.28 },
  right: { x: 513.53, y: 90.86, width: 211.28, height: 211.28 },
};

type HudLook = { opacity: number; transform: unknown };

/** Native stack screens (react-native-screens): a modal like the Viewer, and a pushed one. */
const MODAL_SCREEN: string = 'RNSModalScreen';
const STACK_SCREEN: string = 'RNSScreen';

// Jest's window is upright (portrait), like the phone on its way in.
const UPRIGHT = Dimensions.get('window');

/**
 * Turns the phone: the window takes on its new shape, as it does when iOS
 * rotates the Viewer. Sideways is the headset's two-eye view.
 */
function holdPhone(orientation: 'sideways' | 'upright') {
  const [short, long] = [UPRIGHT.width, UPRIGHT.height].sort((a, b) => a - b);
  const size =
    orientation === 'sideways' ? { width: long, height: short } : { width: short, height: long };
  const window = { ...Dimensions.get('window'), ...size };
  act(() => Dimensions.set({ window, screen: window }));
}

let appStateListeners: ((state: AppStateStatus) => void)[] = [];

beforeEach(() => {
  jest.useFakeTimers();
  queryClient.clear();
  resetSettings();
  // In the headset unless a test says otherwise.
  holdPhone('sideways');
  mockRecenter.mockClear();
  mockSetDebugLook.mockClear();
  mockZoomCalls = [];
  [mockBeginZoom, mockSetZoom, mockEndZoom, mockResetZoom].forEach((mock) => mock.mockClear());
  mockImpact.mockClear();
  mockLiquidGlass.mockReturnValue(true);
  mockStereoEyes = null;
  // Asked before and allowed, unless a test says otherwise.
  mockGetCameraAccess.mockReset().mockResolvedValue('granted');
  mockRequestCameraAccess.mockReset().mockResolvedValue('granted');
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
  holdPhone('upright');
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

/** What the native view reports once every eye has drawn: the view it was asked for, unless told. */
function finishLoading(mode: DioramaViewMode = viewerMap().mode ?? 'mono') {
  act(() => viewerMap().onReady?.({ coverage: 'yes', mode }));
}

/** The map's camera: where you stand and look from, which a turn of the phone keeps. */
function viewerCamera() {
  const { center, altitude, pitch, heading } = viewerMap();
  return { center, altitude, pitch, heading };
}

function wait(ms: number) {
  act(() => jest.advanceTimersByTime(ms));
}

/** Loaded, counted down: the wearer is in the diorama. */
function enterDiorama() {
  finishLoading();
  wait(3000);
}

/**
 * Lets native answers (camera access) reach the screen: promises settle,
 * then queries hand their results over on a timer.
 */
async function settle() {
  for (let pass = 0; pass < 3; pass += 1) {
    await act(async () => {
      jest.advanceTimersByTime(0);
    });
  }
}

/** A promise a test settles when it likes, like an answer to the camera prompt. */
function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((settleWith) => {
    resolve = settleWith;
  });
  return { promise, resolve };
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

/** The gestures that may go on at the same time as this one, by handler tag. */
function goesWith(testId: string): number[] {
  const refs = getByGestureTestId(testId).config.simultaneousWith ?? [];
  return refs.flatMap((ref) => (typeof ref === 'number' ? [ref] : []));
}

function tagOf(testId: string): number {
  return getByGestureTestId(testId).handlerTag;
}

/**
 * Plays layout for one eye's copy of the HUD at its natural `width` ×
 * `height`, and returns how far its corners reach from the eye's center
 * once it's been fitted, and where that center is.
 */
function layOutHud(eye: 'left' | 'right', width: number, height: number) {
  const fit = screen.getByTestId(`hud-fit-${eye}`, HIDDEN);
  act(() => fireEvent(fit, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width, height } } }));
  const style = StyleSheet.flatten(screen.getByTestId(`hud-fit-${eye}`, HIDDEN).props.style);
  const [{ scale }] = style.transform as [{ scale: number }];
  const box = StyleSheet.flatten(screen.getByTestId(`hud-eye-${eye}`, HIDDEN).props.style);
  return {
    reach: Math.hypot(width / 2, height / 2) * scale,
    center: {
      x: Number(box.left) + Number(box.width) / 2,
      y: Number(box.top) + Number(box.height) / 2,
    },
    centered: box.alignItems === 'center' && box.justifyContent === 'center',
    scale,
  };
}

/** One finger dragged across the view, by `dx` and `dy` points in all. */
async function dragBy(dx: number, dy: number) {
  await nextGestureCallbacks();
  act(() =>
    fireGestureHandler(getByGestureTestId('viewer-look-drag'), [
      { state: State.BEGAN, translationX: 0, translationY: 0 },
      { state: State.ACTIVE, translationX: 0, translationY: 0 },
      { translationX: dx / 2, translationY: dy / 2 },
      { translationX: dx, translationY: dy },
      { state: State.END, translationX: dx, translationY: dy },
    ]),
  );
}

/**
 * Two fingers pinched: the pinch takes hold at the first scale (finger
 * spread ÷ spread as they landed), moves through the rest, and lifts.
 */
async function pinch(...scales: [number, ...number[]]) {
  await nextGestureCallbacks();
  const [first, ...rest] = scales;
  act(() =>
    fireGestureHandler(getByGestureTestId('viewer-pinch'), [
      { state: State.BEGAN, scale: 1 },
      { state: State.ACTIVE, scale: first },
      ...rest.map((scale) => ({ scale })),
      { state: State.END, scale: rest.at(-1) ?? first },
    ]),
  );
}

/** A pinch that takes hold and is still going (the fingers never lift). */
async function startPinch() {
  await nextGestureCallbacks();
  const pinchTag = tagOf('viewer-pinch');
  const payload = { handlerTag: pinchTag, scale: 1, focalX: 0, focalY: 0, velocity: 0 };
  act(() => {
    DeviceEventEmitter.emit('onGestureHandlerStateChange', {
      ...payload,
      numberOfPointers: 2,
      state: State.BEGAN,
      oldState: State.UNDETERMINED,
    });
    DeviceEventEmitter.emit('onGestureHandlerStateChange', {
      ...payload,
      numberOfPointers: 2,
      state: State.ACTIVE,
      oldState: State.BEGAN,
    });
  });
}

/** The HUD's glass (one copy: held in the hand), materialized or dissolved. */
function hudGlass() {
  return within(screen.getByTestId('viewer-hud', HIDDEN)).UNSAFE_getByType(GlassView).props
    .glassEffectStyle;
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

    // Per screen (view-controller-based status bars, which iOS 27 requires):
    // the Viewer's modal hides it, the picker underneath keeps it.
    const viewer = screen.UNSAFE_root.findAll(
      (node) => node.type === MODAL_SCREEN && node.props.stackPresentation === 'fullScreenModal',
    );
    expect(viewer.map((node) => node.props.statusBarHidden)).toEqual([true]);
    const picker = screen.UNSAFE_root.findAll(
      (node) => node.type === STACK_SCREEN && node.props.stackPresentation === 'push',
    );
    expect(picker.map((node) => node.props.statusBarHidden)).toEqual([undefined]);
    // Never the app-wide API: with view-controller-based status bars it's an error.
    expect(screen.UNSAFE_queryAllByType(StatusBar)).toHaveLength(0);
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

  it('keeps every HUD inside each eye circle', async () => {
    mockStereoEyes = CIRCLES;
    await openViewer();
    finishLoading();
    const eyeCenter = (rect: DioramaRect) => ({
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2,
    });
    const fitsCircle = (eye: 'left' | 'right', width: number, height: number) => {
      const rect = CIRCLES[eye];
      const hud = layOutHud(eye, width, height);
      // Centered on the eye, and every corner clear of the circle's edge.
      expect(hud.centered).toBe(true);
      expect(hud.center.x).toBeCloseTo(eyeCenter(rect).x, 5);
      expect(hud.center.y).toBeCloseTo(eyeCenter(rect).y, 5);
      expect(hud.reach).toBeLessThanOrEqual(rect.width / 2 - CIRCLE_MARGIN + 1e-9);
      return hud.scale;
    };

    // The countdown with its hint. At the size it used to come to (194 ×
    // 142 pt, corners about 15 pt past the circle), it shrinks to fit...
    expect(screen.getAllByText(COUNTDOWN_HINT, HIDDEN)).toHaveLength(2);
    for (const eye of ['left', 'right'] as const) expect(fitsCircle(eye, 194, 142)).toBeLessThan(1);
    // ...and compact, as it's now laid out, it fits at full size, as does
    // the tallest it gets at the largest text sizes, shrunk.
    for (const eye of ['left', 'right'] as const) expect(fitsCircle(eye, 158, 104)).toBe(1);
    for (const eye of ['left', 'right'] as const) fitsCircle(eye, 169, 230);

    // "Recentered" on its capsule.
    wait(3000);
    await doubleTap();
    expect(screen.getAllByText(RECENTERED, HIDDEN)).toHaveLength(2);
    for (const eye of ['left', 'right'] as const) expect(fitsCircle(eye, 152, 44)).toBe(1);
  });

  it('draws the HUD once held in the hand', async () => {
    holdPhone('upright');
    await openViewer();
    expect(viewerMap().mode).toBe('mono');
    finishLoading();

    await doubleTap();
    expect(screen.getAllByText(RECENTERED, HIDDEN)).toHaveLength(1);
    expect(screen.getByTestId('hud-eye-both', HIDDEN)).toHaveTextContent(RECENTERED);
  });

  it('materializes the recenter HUD, then dissolves it on its own', async () => {
    // Mono: under Jest, Reanimated only tracks one view per animated style
    // (on a phone both eye copies follow it).
    holdPhone('upright');
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
    holdPhone('upright');
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
    holdPhone('upright');
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
    fireEvent.press(await screen.findByRole('button', { name: 'Enter Mini City' }));
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
      setTwoEyeLandscape(false);
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

  it('waits for a tap held in the hand, then fades out 3 s later', async () => {
    holdPhone('upright');
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

  it('exits held in the hand too, once a tap has shown it', async () => {
    holdPhone('upright');
    const router = await openViewer();
    enterDiorama();

    await tap();
    await act(async () => fireEvent.press(screen.getByRole('button', EXIT)));

    expect(router.getPathname()).toBe('/city/paris');
    await landOnPreview();
  });

  it('never slows or blocks a double-tap recenter', async () => {
    holdPhone('upright');
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
    // A drag to look waits for nothing either.
    expect(waitsFor('viewer-look-drag')).toEqual([]);
  });

  it('only fades under Reduce Motion, with no scale', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    holdPhone('upright');
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

describe('viewer orientation', () => {
  it('turns every way but upside down, while the other screens stay upright', async () => {
    await openViewer();

    // The Viewer is a full-screen modal; `default` is all but upside down on iOS.
    const viewer = screen.UNSAFE_root.findAll(
      (node) => node.type === MODAL_SCREEN && node.props.stackPresentation === 'fullScreenModal',
    );
    expect(viewer).toHaveLength(1);
    expect(viewer[0].props.screenOrientation).toBe('default');
    // The picker underneath stays portrait, so leaving turns the phone back upright.
    const picker = screen.UNSAFE_root.findAll(
      (node) => node.type === STACK_SCREEN && node.props.stackPresentation === 'push',
    );
    expect(picker.map((node) => node.props.screenOrientation)).toEqual(['portrait']);
  });

  it('held upright, fills the screen and follows the phone as soon as it draws', async () => {
    holdPhone('upright');
    await openViewer();
    expect(viewerMap().mode).toBe('mono');
    expect(viewerMap().headTracking).toBe(false);

    // Still loading behind the black cover.
    wait(5000);
    expect(mockRecenter).not.toHaveBeenCalled();

    // No countdown: it recenters and follows the phone at once.
    finishLoading();
    expect(mockRecenter).toHaveBeenCalledTimes(1);
    expect(viewerMap().headTracking).toBe(true);
    expect(screen.queryAllByText(COUNTDOWN_TITLE, HIDDEN)).toHaveLength(0);
    wait(5000);
    expect(screen.queryAllByText(COUNTDOWN_TITLE, HIDDEN)).toHaveLength(0);
    expect(mockRecenter).toHaveBeenCalledTimes(1);

    // A later render report changes nothing.
    finishLoading();
    expect(mockRecenter).toHaveBeenCalledTimes(1);

    // Double-tap recenters straight away, and the ✕ waits for a tap.
    await doubleTap();
    expect(mockRecenter).toHaveBeenCalledTimes(2);
    expect(exitButton()).toBeNull();
    await tap();
    expect(exitButton()).toBeOnTheScreen();
  });

  it('sideways, shows the two-eye view with the countdown', async () => {
    await openViewer();
    expect(viewerMap().mode).toBe('stereo');

    finishLoading();
    expect(screen.getAllByText(COUNTDOWN_TITLE, HIDDEN)).toHaveLength(2);
    expect(viewerMap().headTracking).toBe(false);
    expect(mockRecenter).not.toHaveBeenCalled();
    // The ✕ stays up, in the black margin.
    expect(exitButton()).toBeOnTheScreen();

    wait(3000);
    expect(mockRecenter).toHaveBeenCalledTimes(1);
    expect(viewerMap().headTracking).toBe(true);
  });

  it('turned sideways, switches to the two eyes and counts down again once they draw', async () => {
    holdPhone('upright');
    await openViewer();
    finishLoading();
    const camera = viewerCamera();
    expect(mockRecenter).toHaveBeenCalledTimes(1);

    holdPhone('sideways');

    // Same spot; the fresh eyes load behind the black cover, not tracking yet.
    expect(viewerMap().mode).toBe('stereo');
    expect(viewerCamera()).toEqual(camera);
    expect(viewerMap().headTracking).toBe(false);
    expect(exitButton()).toBeOnTheScreen();
    wait(5000);
    expect(screen.queryAllByText(COUNTDOWN_TITLE, HIDDEN)).toHaveLength(0);
    expect(mockRecenter).toHaveBeenCalledTimes(1);

    // Time to put the phone in the headset, then straight ahead is where you face.
    finishLoading();
    expect(screen.getAllByText(COUNTDOWN_TITLE, HIDDEN)).toHaveLength(2);
    wait(2000);
    expect(screen.getAllByText('1', HIDDEN)).toHaveLength(2);
    expect(mockRecenter).toHaveBeenCalledTimes(1);
    wait(1000);
    expect(mockRecenter).toHaveBeenCalledTimes(2);
    expect(viewerMap().headTracking).toBe(true);

    // A later render report in the same view never starts it again.
    finishLoading();
    wait(3000);
    expect(screen.queryAllByText('3', HIDDEN)).toHaveLength(0);
    expect(mockRecenter).toHaveBeenCalledTimes(2);
  });

  it('turned back upright, fills the screen and recenters at once', async () => {
    mockStereoEyes = EYES;
    await openViewer();
    enterDiorama();
    const camera = viewerCamera();
    mockRecenter.mockClear();

    holdPhone('upright');

    expect(viewerMap().mode).toBe('mono');
    expect(viewerCamera()).toEqual(camera);
    expect(mockRecenter).toHaveBeenCalledTimes(1);
    expect(viewerMap().headTracking).toBe(true);
    // The ✕ goes back to waiting for a tap.
    expect(exitButton()).toBeNull();

    // No countdown (the HUD stays clear), and no second recenter later.
    wait(5000);
    expect(hudGlass()).toMatchObject({ style: 'none' });
    expect(mockRecenter).toHaveBeenCalledTimes(1);
  });

  it('turned upright mid-countdown, stops it and goes straight in', async () => {
    await openViewer();
    finishLoading();
    wait(1000);
    expect(screen.getAllByText('2', HIDDEN)).toHaveLength(2);

    holdPhone('upright');

    expect(mockRecenter).toHaveBeenCalledTimes(1);
    expect(viewerMap().headTracking).toBe(true);
    // The countdown's glass dissolves, and it never comes back or finishes.
    wait(1000);
    expect(hudGlass()).toMatchObject({ style: 'none' });
    wait(5000);
    expect(hudGlass()).toMatchObject({ style: 'none' });
    expect(mockRecenter).toHaveBeenCalledTimes(1);
  });

  it('turned while still loading, waits for the map either way', async () => {
    holdPhone('upright');
    await openViewer();

    // Sideways before anything drew: the countdown follows the first draw.
    holdPhone('sideways');
    expect(viewerMap().mode).toBe('stereo');
    finishLoading();
    expect(screen.getAllByText(COUNTDOWN_TITLE, HIDDEN)).toHaveLength(2);
    expect(mockRecenter).not.toHaveBeenCalled();
    wait(3000);
    expect(mockRecenter).toHaveBeenCalledTimes(1);
  });

  it('ignores a late report from the one picture once turned sideways', async () => {
    holdPhone('upright');
    await openViewer();

    // The one picture finishes just as the phone turns: its report lands late.
    holdPhone('sideways');
    finishLoading('mono');
    expect(screen.queryAllByText(COUNTDOWN_TITLE, HIDDEN)).toHaveLength(0);
    expect(viewerMap().headTracking).toBe(false);

    // The countdown waits for the two eyes.
    finishLoading('stereo');
    expect(screen.getAllByText(COUNTDOWN_TITLE, HIDDEN)).toHaveLength(2);
  });

  it('counts down on one picture when too hot for two while loading', async () => {
    await openViewer();

    // The native view falls back to one picture, then reports it drawn.
    act(() => viewerMap().onDegraded?.({ reason: 'thermal' }));
    finishLoading('mono');

    expect(screen.getAllByText(COUNTDOWN_TITLE, HIDDEN)).toHaveLength(1);
    wait(3000);
    expect(mockRecenter).toHaveBeenCalledTimes(1);
    expect(viewerMap().headTracking).toBe(true);
  });

  it('turned upright while the two eyes load, recenters once the one picture draws', async () => {
    await openViewer();

    holdPhone('upright');
    expect(viewerMap().mode).toBe('mono');
    expect(viewerMap().headTracking).toBe(false);
    expect(mockRecenter).not.toHaveBeenCalled();

    finishLoading();
    expect(mockRecenter).toHaveBeenCalledTimes(1);
    expect(viewerMap().headTracking).toBe(true);
    expect(screen.queryAllByText(COUNTDOWN_TITLE, HIDDEN)).toHaveLength(0);
  });

  it('with "Two-eye view in landscape" off, fills the screen sideways too', async () => {
    setTwoEyeLandscape(false);
    await openViewer();

    expect(viewerMap().mode).toBe('mono');
    finishLoading();
    expect(screen.queryAllByText(COUNTDOWN_TITLE, HIDDEN)).toHaveLength(0);
    expect(mockRecenter).toHaveBeenCalledTimes(1);
    expect(viewerMap().headTracking).toBe(true);
    expect(exitButton()).toBeNull();

    // And turning the phone keeps it that way.
    holdPhone('upright');
    expect(viewerMap().mode).toBe('mono');
    holdPhone('sideways');
    expect(viewerMap().mode).toBe('mono');
    expect(viewerMap().headTracking).toBe(true);
  });

  it('lifts a cool-down to one picture with the next turn into the headset', async () => {
    await openViewer();
    enterDiorama();
    act(() => viewerMap().onDegraded?.({ reason: 'thermal' }));
    expect(screen.getAllByText(COOLING, HIDDEN)).toHaveLength(1);

    holdPhone('upright');
    holdPhone('sideways');
    finishLoading();

    // A new mode lifts the native fallback, so the HUD is per eye again.
    expect(screen.getAllByText(COUNTDOWN_TITLE, HIDDEN)).toHaveLength(2);
  });
});

describe('viewer drag to look', () => {
  it('held upright, turns the view with one finger, the city following it', async () => {
    holdPhone('upright');
    await openViewer();
    finishLoading();

    // Left and down: look right and up, as the city moves with the finger.
    await dragBy(-40, 20);
    expect(mockSetDebugLook).toHaveBeenLastCalledWith(
      40 * LOOK_DEGREES_PER_POINT,
      20 * LOOK_DEGREES_PER_POINT,
    );
    expect(getByGestureTestId('viewer-look-drag').config).toMatchObject({ maxPointers: 1 });

    // The next drag carries on from there.
    await dragBy(-20, 0);
    expect(mockSetDebugLook).toHaveBeenLastCalledWith(
      60 * LOOK_DEGREES_PER_POINT,
      20 * LOOK_DEGREES_PER_POINT,
    );

    // A recenter starts it from straight ahead again.
    await doubleTap();
    await dragBy(8, 0);
    expect(mockSetDebugLook).toHaveBeenLastCalledWith(-8 * LOOK_DEGREES_PER_POINT, 0);
  });

  it('stops at straight up and straight down', async () => {
    holdPhone('upright');
    await openViewer();
    finishLoading();

    await dragBy(0, 10_000);
    expect(mockSetDebugLook).toHaveBeenLastCalledWith(0, 90);
    await dragBy(0, -20_000);
    expect(mockSetDebugLook).toHaveBeenLastCalledWith(0, -90);
  });

  it('only drags once the view follows the phone, and never in the headset', async () => {
    holdPhone('upright');
    await openViewer();

    // Still loading.
    await dragBy(-40, 0);
    expect(mockSetDebugLook).not.toHaveBeenCalled();

    // In the headset there's nothing to drag.
    holdPhone('sideways');
    enterDiorama();
    await dragBy(-40, 0);
    expect(mockSetDebugLook).not.toHaveBeenCalled();

    // Back upright, it drags from straight ahead.
    holdPhone('upright');
    await dragBy(-40, 0);
    expect(mockSetDebugLook).toHaveBeenLastCalledWith(40 * LOOK_DEGREES_PER_POINT, 0);
  });

  it("leaves dragging to the map's own debug look", async () => {
    setDebugLook(true);
    holdPhone('upright');
    await openViewer();
    finishLoading();

    await dragBy(-40, 0);

    expect(mockSetDebugLook).not.toHaveBeenCalled();
    expect(viewerMap().debugLook).toBe(true);
  });

  it('still recenters on a double-tap and exits on a hold', async () => {
    holdPhone('upright');
    const router = await openViewer();
    finishLoading();
    mockRecenter.mockClear();

    await doubleTap();
    expect(mockRecenter).toHaveBeenCalledTimes(1);

    await holdToExit();
    expect(router.getPathname()).toBe('/city/paris');
    await landOnPreview();
  });
});

describe('viewer pinch to zoom', () => {
  it('held upright, moves nearer to what is in the middle of the view, or farther', async () => {
    holdPhone('upright');
    await openViewer();
    finishLoading();

    // Spread from where the pinch took hold (1.25), so it never starts with a jump.
    await pinch(1.25, 1.25, 2.5, 5);
    expect(mockZoomCalls).toEqual(['begin', 'set 1', 'set 2', 'set 4', 'end']);

    // Together: backs away.
    mockZoomCalls = [];
    await pinch(1, 0.5);
    expect(mockZoomCalls).toEqual(['begin', 'set 0.5', 'end']);
    // The map does all the moving: nothing else went across.
    expect(mockSetDebugLook).not.toHaveBeenCalled();
    expect(mockResetZoom).not.toHaveBeenCalled();
  });

  it('goes along with a drag, and never recenters, exits or shows the ✕', async () => {
    holdPhone('upright');
    const router = await openViewer();
    finishLoading();
    mockRecenter.mockClear();

    // A pinch and a drag wait for nothing and go on together; the taps and
    // the hold wait only for each other, and give way to either.
    expect(waitsFor('viewer-pinch')).toEqual([]);
    expect(waitsFor('viewer-look-drag')).toEqual([]);
    expect(goesWith('viewer-pinch')).toEqual([tagOf('viewer-look-drag')]);
    expect(goesWith('viewer-look-drag')).toEqual([tagOf('viewer-pinch')]);
    for (const other of ['viewer-double-tap', 'viewer-tap', 'viewer-long-press']) {
      expect(goesWith(other)).toEqual([]);
      expect(waitsFor(other)).not.toContain(tagOf('viewer-pinch'));
    }

    await dragBy(-40, 0);
    await pinch(1, 3);
    wait(EXIT_HOLD_MS * 2);

    expect(mockZoomCalls).toEqual(['begin', 'set 3', 'end']);
    expect(mockSetDebugLook).toHaveBeenLastCalledWith(40 * LOOK_DEGREES_PER_POINT, 0);
    expect(mockRecenter).not.toHaveBeenCalled();
    expect(exitButton()).toBeNull();
    expect(router.getPathname()).toBe('/view/paris');
  });

  it('keeps the zoom through a recenter', async () => {
    holdPhone('upright');
    await openViewer();
    finishLoading();
    await pinch(1, 2);
    mockRecenter.mockClear();

    await doubleTap();

    expect(mockRecenter).toHaveBeenCalledTimes(1);
    expect(mockZoomCalls).toEqual(['begin', 'set 2', 'end']);
  });

  it('only zooms once the view follows the phone', async () => {
    holdPhone('upright');
    await openViewer();

    // Still loading.
    await pinch(1, 2);
    expect(mockZoomCalls).toEqual([]);

    finishLoading();
    await pinch(1, 2);
    expect(mockZoomCalls).toEqual(['begin', 'set 2', 'end']);
  });

  it('turned sideways, goes back to the normal distance and ignores pinches in the headset', async () => {
    holdPhone('upright');
    await openViewer();
    finishLoading();
    await pinch(1, 2);
    mockZoomCalls = [];

    holdPhone('sideways');
    expect(viewerMap().mode).toBe('stereo');
    expect(mockZoomCalls).toEqual(['reset']);

    // Loading, counting down, then worn: no pinch at any point.
    await pinch(1, 2);
    finishLoading();
    await pinch(1, 2);
    wait(3000);
    expect(viewerMap().headTracking).toBe(true);
    await pinch(1, 2);
    expect(mockZoomCalls).toEqual(['reset']);

    // Back upright, it zooms again from the normal distance.
    holdPhone('upright');
    await pinch(1, 0.5);
    expect(mockZoomCalls).toEqual(['reset', 'begin', 'set 0.5', 'end']);
  });

  it('zooms upright only, with the two-eye view off too', async () => {
    setTwoEyeLandscape(false);
    holdPhone('upright');
    await openViewer();
    finishLoading();
    await pinch(1, 2);
    mockZoomCalls = [];

    // Sideways it is one picture too, but not one to zoom.
    holdPhone('sideways');
    expect(viewerMap()).toMatchObject({ mode: 'mono', headTracking: true });
    expect(mockZoomCalls).toEqual(['reset']);
    await pinch(1, 2);
    expect(mockZoomCalls).toEqual(['reset']);
  });

  it('lets go of a pinch the app leaves mid-way', async () => {
    holdPhone('upright');
    await openViewer();
    finishLoading();

    await startPinch();
    expect(mockZoomCalls).toEqual(['begin']);
    setAppState('inactive');

    // The fingers never lift, so the view lets go of the pinch itself.
    expect(mockZoomCalls).toEqual(['begin', 'end']);
    expect(mockResetZoom).not.toHaveBeenCalled();
  });

  it('leaves the zoom behind with the map on the way out, without moving it first', async () => {
    holdPhone('upright');
    const router = await openViewer();
    finishLoading();
    await pinch(1, 2);

    await holdToExit();

    expect(router.getPathname()).toBe('/city/paris');
    // The Viewer's map is gone, zoom and all; the next visit starts afresh.
    expect(screen.queryByTestId('viewer-map')).toBeNull();
    expect(mockZoomCalls).toEqual(['begin', 'set 2', 'end']);
    await landOnPreview();
  });

  it('lets VoiceOver zoom a step at a time, upright only', async () => {
    holdPhone('upright');
    await openViewer();
    finishLoading();
    const view = () => screen.getByTestId('viewer-screen');
    expect(view().props.accessibilityActions).toEqual(
      expect.arrayContaining([
        { name: 'zoomIn', label: 'Zoom in' },
        { name: 'zoomOut', label: 'Zoom out' },
      ]),
    );

    fireEvent(view(), 'accessibilityAction', { nativeEvent: { actionName: 'zoomIn' } });
    fireEvent(view(), 'accessibilityAction', { nativeEvent: { actionName: 'zoomOut' } });
    expect(mockZoomCalls).toEqual([
      'begin',
      `set ${ZOOM_STEP}`,
      'end',
      'begin',
      `set ${1 / ZOOM_STEP}`,
      'end',
    ]);

    // In the headset there's nothing to zoom.
    holdPhone('sideways');
    const names = view().props.accessibilityActions.map(({ name }: { name: string }) => name);
    expect(names).not.toContain('zoomIn');
    expect(names).not.toContain('zoomOut');
  });
});

function glyphOpacity(): number {
  return getAnimatedStyle(screen.getByTestId('viewer-exit-glyph', HIDDEN)).opacity as number;
}

describe('viewer lean to move closer', () => {
  const LOOK_AROUND = HUD_NOTICES.leanStarting.text;
  const HOLD_STILL = HUD_NOTICES.leanLimited.text;

  /** What the map says about lean's camera tracking. */
  function reportLean(state: DioramaHeadPositionState) {
    act(() => viewerMap().onHeadPositionState?.({ state }));
  }

  /** Whether the HUD (one copy: held in the hand) is up. */
  function hudIsUp(): boolean {
    return hudGlass().style !== 'none';
  }

  /** Held in the hand, in the diorama, following the phone. */
  async function enterUpright() {
    holdPhone('upright');
    await openViewer();
    await settle();
    enterDiorama();
  }

  it('leans as set in Settings, once the camera may be used', async () => {
    await openViewer();
    await settle();

    expect(viewerMap()).toMatchObject({ headPosition: true, leanGain: 1 });
    // Live, like every setting.
    act(() => setLeanGain(3));
    expect(viewerMap().leanGain).toBe(3);
    act(() => setHeadPosition(false));
    expect(viewerMap().headPosition).toBe(false);
    // Asked on an earlier visit: no prompt.
    expect(mockRequestCameraAccess).not.toHaveBeenCalled();
  });

  it('asks for the camera on the first visit, and counts down once it is answered', async () => {
    mockGetCameraAccess.mockResolvedValue('undetermined');
    const answer = deferred<CameraAccess>();
    mockRequestCameraAccess.mockReturnValue(answer.promise);
    await openViewer();
    await settle();

    // Straight away, while the city loads and the phone is still in the hand.
    expect(mockRequestCameraAccess).toHaveBeenCalledTimes(1);
    expect(viewerMap().headPosition).toBe(false);

    // The city draws behind the prompt, and the countdown waits for the answer.
    finishLoading();
    wait(5000);
    expect(screen.queryAllByText(COUNTDOWN_TITLE, HIDDEN)).toHaveLength(0);
    expect(viewerMap().headTracking).toBe(false);

    answer.resolve('granted');
    await settle();
    expect(viewerMap().headPosition).toBe(true);
    expect(screen.getAllByText(COUNTDOWN_TITLE, HIDDEN)).toHaveLength(2);
    expect(screen.getAllByText('3', HIDDEN)).not.toHaveLength(0);
    wait(3000);
    expect(viewerMap()).toMatchObject({ headTracking: true, headPosition: true });
    expect(mockRequestCameraAccess).toHaveBeenCalledTimes(1);
  });

  it('asks held upright too, and follows the phone meanwhile', async () => {
    mockGetCameraAccess.mockResolvedValue('undetermined');
    const answer = deferred<CameraAccess>();
    mockRequestCameraAccess.mockReturnValue(answer.promise);
    holdPhone('upright');
    await openViewer();
    await settle();
    finishLoading();

    expect(mockRequestCameraAccess).toHaveBeenCalledTimes(1);
    expect(viewerMap()).toMatchObject({ mode: 'mono', headTracking: true, headPosition: false });

    answer.resolve('granted');
    await settle();
    expect(viewerMap()).toMatchObject({ headTracking: true, headPosition: true });
  });

  it('turns lean off quietly when the camera is declined, and Settings says so', async () => {
    mockGetCameraAccess.mockResolvedValue('undetermined');
    mockRequestCameraAccess.mockImplementation(() => {
      // iOS remembers the answer from now on.
      mockGetCameraAccess.mockResolvedValue('denied');
      return Promise.resolve('denied');
    });
    await openViewer();
    await settle();
    enterDiorama();

    // Turning your head still works; nothing is said about it.
    expect(viewerMap()).toMatchObject({ headTracking: true, headPosition: false });
    expect(screen.queryAllByText(LOOK_AROUND, HIDDEN)).toHaveLength(0);
    expect(mockRequestCameraAccess).toHaveBeenCalledTimes(1);

    await holdToExit();
    await landOnPreview();
    act(() => appRouter.push('/settings'));
    expect(await screen.findByRole('button', { name: CAMERA_OFF })).toBeOnTheScreen();
    expect(mockRequestCameraAccess).toHaveBeenCalledTimes(1);
  });

  it.each<CameraAccess>(['granted', 'denied', 'unsupported'])(
    'never asks when access is already %s',
    async (access) => {
      mockGetCameraAccess.mockResolvedValue(access);
      await openViewer();
      await settle();
      enterDiorama();

      expect(mockRequestCameraAccess).not.toHaveBeenCalled();
      expect(viewerMap().headPosition).toBe(access === 'granted');
      expect(viewerMap().headTracking).toBe(true);
    },
  );

  it('never asks, or even looks, with lean off', async () => {
    act(() => setHeadPosition(false));
    mockGetCameraAccess.mockResolvedValue('undetermined');
    await openViewer();
    await settle();
    enterDiorama();

    expect(mockGetCameraAccess).not.toHaveBeenCalled();
    expect(mockRequestCameraAccess).not.toHaveBeenCalled();
    expect(viewerMap()).toMatchObject({ headTracking: true, headPosition: false });
  });

  it('never asks in the headset once the countdown has begun, only back in the hand', async () => {
    const access = deferred<CameraAccess>();
    mockGetCameraAccess.mockReturnValue(access.promise);
    await openViewer();
    finishLoading();
    expect(screen.getAllByText(COUNTDOWN_TITLE, HIDDEN)).toHaveLength(2);

    // Access comes back unanswered only now: too late, it's on the head.
    access.resolve('undetermined');
    await settle();
    expect(mockRequestCameraAccess).not.toHaveBeenCalled();
    wait(3000);
    expect(viewerMap()).toMatchObject({ headTracking: true, headPosition: false });
    expect(mockRequestCameraAccess).not.toHaveBeenCalled();

    // Taken off and held upright, it may ask.
    holdPhone('upright');
    await settle();
    expect(mockRequestCameraAccess).toHaveBeenCalledTimes(1);
  });

  it('says "Look around the room to start" while the camera gets its bearings', async () => {
    await enterUpright();
    expect(hudIsUp()).toBe(false);

    reportLean('starting');
    expect(screen.getAllByText(LOOK_AROUND, HIDDEN)).toHaveLength(1);
    expect(hudIsUp()).toBe(true);
    wait(3000);
    expect(hudIsUp()).toBe(true);

    // Found: it fades.
    reportLean('tracking');
    wait(0);
    expect(hudIsUp()).toBe(false);
  });

  it('keeps a hint up long enough to read, even when tracking starts at once', async () => {
    await enterUpright();

    reportLean('starting');
    wait(200);
    reportLean('tracking');
    wait(NOTICE_MIN_MS - 300);
    expect(hudIsUp()).toBe(true);
    wait(100);
    expect(hudIsUp()).toBe(false);
  });

  it('lets the hint go on its own if the camera never gets its bearings', async () => {
    await enterUpright();

    reportLean('starting');
    wait(HUD_NOTICES.leanStarting.holdMs - 100);
    expect(hudIsUp()).toBe(true);
    wait(100);
    expect(hudIsUp()).toBe(false);
  });

  it('says "Hold still, finding your place" once lost for a few seconds, then fades', async () => {
    await enterUpright();
    reportLean('starting');
    reportLean('tracking');
    wait(NOTICE_MIN_MS);
    expect(hudIsUp()).toBe(false);

    reportLean('limited');
    wait(LIMITED_HINT_DELAY_MS - 100);
    expect(hudIsUp()).toBe(false);
    expect(screen.queryAllByText(HOLD_STILL, HIDDEN)).toHaveLength(0);
    wait(100);
    expect(screen.getAllByText(HOLD_STILL, HIDDEN)).toHaveLength(1);
    expect(hudIsUp()).toBe(true);

    // Found its place again.
    reportLean('tracking');
    wait(NOTICE_MIN_MS);
    expect(hudIsUp()).toBe(false);

    // Still lost after its hold time, it doesn't stay up either.
    reportLean('limited');
    wait(LIMITED_HINT_DELAY_MS);
    expect(hudIsUp()).toBe(true);
    wait(HUD_NOTICES.leanLimited.holdMs);
    expect(hudIsUp()).toBe(false);
  });

  it('says nothing about a short loss', async () => {
    await enterUpright();
    reportLean('tracking');

    reportLean('limited');
    wait(LIMITED_HINT_DELAY_MS - 500);
    reportLean('tracking');
    wait(5000);

    expect(screen.queryAllByText(HOLD_STILL, HIDDEN)).toHaveLength(0);
    expect(hudIsUp()).toBe(false);
  });

  it('leaves a recenter HUD alone when tracking starts under it', async () => {
    await enterUpright();
    reportLean('starting');
    wait(2000);

    await doubleTap();
    reportLean('tracking');
    wait(0);
    // "Recentered" keeps its own time.
    expect(screen.getAllByText(RECENTERED, HIDDEN)).toHaveLength(1);
    expect(hudIsUp()).toBe(true);
    wait(HUD_NOTICES.recentered.holdMs);
    expect(hudIsUp()).toBe(false);
  });

  it('shows the hints once per eye in the headset, after the countdown', async () => {
    await openViewer();
    await settle();
    enterDiorama();

    reportLean('starting');

    expect(screen.getAllByText(LOOK_AROUND, HIDDEN)).toHaveLength(2);
    expect(screen.getByTestId('hud-eye-left', HIDDEN)).toHaveTextContent(LOOK_AROUND);
    expect(screen.getByTestId('hud-eye-right', HIDDEN)).toHaveTextContent(LOOK_AROUND);
  });
});

describe('viewer compass (live mode)', () => {
  const FIGURE_8 = HUD_NOTICES.compassCalibrating.text;

  /** What the map says about the compass it lines the city up with. */
  function reportCompass(state: DioramaCompassState) {
    act(() => viewerMap().onCompassState?.({ state }));
  }

  function hudIsUp(): boolean {
    return hudGlass().style !== 'none';
  }

  /** Held in the hand, in the diorama, following the phone. */
  async function enterUpright() {
    holdPhone('upright');
    await openViewer();
    await settle();
    enterDiorama();
  }

  it('asks for a figure 8 while the compass calibrates, and fades once it is good', async () => {
    await enterUpright();
    reportCompass('calibrating');

    // A compass that settles at once never shows it.
    wait(CALIBRATING_HINT_DELAY_MS - 100);
    expect(screen.queryAllByText(FIGURE_8, HIDDEN)).toHaveLength(0);
    expect(hudIsUp()).toBe(false);
    wait(100);
    expect(screen.getAllByText(FIGURE_8, HIDDEN)).toHaveLength(1);
    expect(hudIsUp()).toBe(true);
    wait(NOTICE_MIN_MS);
    expect(hudIsUp()).toBe(true);

    // Calibrated: it fades.
    reportCompass('good');
    wait(0);
    expect(hudIsUp()).toBe(false);
  });

  it('says nothing when the compass is good at once', async () => {
    await enterUpright();

    reportCompass('calibrating');
    wait(CALIBRATING_HINT_DELAY_MS - 500);
    reportCompass('good');
    wait(5000);

    expect(screen.queryAllByText(FIGURE_8, HIDDEN)).toHaveLength(0);
    expect(hudIsUp()).toBe(false);
  });

  it('keeps the hint up long enough to read, then lets it go', async () => {
    await enterUpright();

    reportCompass('calibrating');
    wait(CALIBRATING_HINT_DELAY_MS);
    reportCompass('good');
    wait(NOTICE_MIN_MS - 100);
    expect(hudIsUp()).toBe(true);
    wait(100);
    expect(hudIsUp()).toBe(false);
  });

  it('fades on its own if the compass never settles, and quietly when true north gives up', async () => {
    await enterUpright();

    reportCompass('calibrating');
    wait(CALIBRATING_HINT_DELAY_MS + HUD_NOTICES.compassCalibrating.holdMs - 100);
    expect(hudIsUp()).toBe(true);
    wait(100);
    expect(hudIsUp()).toBe(false);

    // A headset magnet: after a while the map gives up, and nothing more is said.
    reportCompass('unavailable');
    wait(10000);
    expect(hudIsUp()).toBe(false);
  });

  it('lets the hint go at once when true north gives up while it is up', async () => {
    await enterUpright();

    reportCompass('calibrating');
    wait(CALIBRATING_HINT_DELAY_MS + NOTICE_MIN_MS);
    expect(hudIsUp()).toBe(true);
    reportCompass('unavailable');
    wait(0);
    expect(hudIsUp()).toBe(false);
  });

  it('shows the hint once per eye in the headset', async () => {
    await openViewer();
    await settle();
    enterDiorama();

    reportCompass('calibrating');
    wait(CALIBRATING_HINT_DELAY_MS);

    expect(screen.getAllByText(FIGURE_8, HIDDEN)).toHaveLength(2);
    expect(screen.getByTestId('hud-eye-left', HIDDEN)).toHaveTextContent(FIGURE_8);
    expect(screen.getByTestId('hud-eye-right', HIDDEN)).toHaveTextContent(FIGURE_8);
  });
});
