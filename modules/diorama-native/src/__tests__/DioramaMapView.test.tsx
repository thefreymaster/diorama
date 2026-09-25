import { act, fireEvent, render, renderHook } from '@testing-library/react-native';
import { createRef } from 'react';

import {
  DEFAULT_MAP_STYLE,
  DEFAULT_WINDOW_DIAMETER,
  DioramaMapView,
  MAP_STYLES,
  mapStyleShown,
  useStereoEyes,
  type DioramaEyeLayout,
  type DioramaMapViewRef,
} from '..';
import { NativeDioramaMapView } from '../NativeDioramaMapView';

const CAMERA = {
  center: { latitude: 40.7549, longitude: -73.984 },
  altitude: 1200,
  pitch: 60,
  heading: 29,
};

// What the native view reports on an iPhone 17 Pro in landscape, with the
// default 35 mm circles 64 mm apart (measured in the Simulator): the square
// around each circle, centered on its lens at x = 243.83 and 630.17.
const STEREO_LAYOUT: DioramaEyeLayout = {
  mode: 'stereo',
  left: { x: 138.33, y: 95.67, width: 211, height: 211 },
  right: { x: 524.67, y: 95.67, width: 211, height: 211 },
};
const WHOLE_VIEW = { x: 0, y: 0, width: 874, height: 402 };
const MONO_LAYOUT: DioramaEyeLayout = { mode: 'mono', left: WHOLE_VIEW, right: WHOLE_VIEW };

describe('DioramaMapView', () => {
  it('renders and exposes recenter() and setDebugLook() on its ref', () => {
    const ref = createRef<DioramaMapViewRef>();
    const view = render(<DioramaMapView ref={ref} {...CAMERA} />);
    expect(view.toJSON()).toBeTruthy();
    expect(typeof ref.current?.recenter).toBe('function');
    expect(typeof ref.current?.setDebugLook).toBe('function');
  });

  it('exposes pinch to zoom on its ref: begin, set, end and reset', () => {
    const ref = createRef<DioramaMapViewRef>();
    render(<DioramaMapView ref={ref} {...CAMERA} headTracking />);
    expect(typeof ref.current?.beginZoom).toBe('function');
    expect(typeof ref.current?.setZoom).toBe('function');
    expect(typeof ref.current?.endZoom).toBe('function');
    expect(typeof ref.current?.resetZoom).toBe('function');
  });

  it('exposes followTo() on its ref for live location', () => {
    const ref = createRef<DioramaMapViewRef>();
    render(<DioramaMapView ref={ref} {...CAMERA} />);
    expect(typeof ref.current?.followTo).toBe('function');
  });

  it('exposes setDebugLean() on its ref and passes tracking on (true unless said)', async () => {
    const ref = createRef<DioramaMapViewRef>();
    const view = render(<DioramaMapView ref={ref} {...CAMERA} headTracking headPosition />);
    const native = { setDebugLean: jest.fn(() => Promise.resolve()) };
    // The native ref's methods live on the native view; stand one in.
    const nativeRef = view.UNSAFE_getByType(NativeDioramaMapView).props.ref as {
      current: unknown;
    };
    nativeRef.current = native;
    await ref.current?.setDebugLean(0, -0.2, 0);
    await ref.current?.setDebugLean(0.1, 0, 0, false);
    expect(native.setDebugLean.mock.calls).toEqual([
      [0, -0.2, 0, true],
      [0.1, 0, 0, false],
    ]);
  });

  it('leaves head position off by default, at the true-to-scale gain, up and down included', () => {
    const view = render(<DioramaMapView {...CAMERA} headTracking />);
    expect(view.toJSON()).toMatchObject({
      props: { headPosition: false, leanGain: 1, leanVertical: true },
    });
  });

  it('passes leaving up and down out of the lean to the native view', () => {
    const view = render(
      <DioramaMapView {...CAMERA} headTracking headPosition leanVertical={false} />,
    );
    expect(view.toJSON()).toMatchObject({
      props: { headPosition: true, leanVertical: false },
    });
  });

  it('draws photoreal imagery unless told another map style', () => {
    const view = render(<DioramaMapView {...CAMERA} />);
    expect(view.toJSON()).toMatchObject({ props: { mapStyle: 'satellite' } });
    expect(DEFAULT_MAP_STYLE).toBe('satellite');
  });

  it('passes each map style to the native view, and a change in place', () => {
    const view = render(<DioramaMapView {...CAMERA} mapStyle="standard" />);
    expect(view.toJSON()).toMatchObject({ props: { mapStyle: 'standard' } });

    view.rerender(<DioramaMapView {...CAMERA} mapStyle="hybrid" />);
    expect(view.toJSON()).toMatchObject({ props: { mapStyle: 'hybrid', ...CAMERA } });
  });

  it('lists the map styles in menu order', () => {
    expect(MAP_STYLES).toEqual(['satellite', 'hybrid', 'standard']);
  });

  it('draws no traffic unless asked', () => {
    const view = render(<DioramaMapView {...CAMERA} mapStyle="standard" />);
    expect(view.toJSON()).toMatchObject({ props: { mapStyle: 'standard', showsTraffic: false } });
  });

  it('passes traffic to the native view in the styles that draw it, and a change in place', () => {
    const view = render(<DioramaMapView {...CAMERA} mapStyle="standard" showsTraffic />);
    expect(view.toJSON()).toMatchObject({ props: { mapStyle: 'standard', showsTraffic: true } });

    view.rerender(<DioramaMapView {...CAMERA} mapStyle="hybrid" showsTraffic />);
    expect(view.toJSON()).toMatchObject({ props: { mapStyle: 'hybrid', showsTraffic: true } });

    view.rerender(<DioramaMapView {...CAMERA} mapStyle="hybrid" showsTraffic={false} />);
    expect(view.toJSON()).toMatchObject({
      props: { mapStyle: 'hybrid', showsTraffic: false, ...CAMERA },
    });
  });

  it('draws satellite with labels while traffic is on, since imagery alone has none', () => {
    const view = render(<DioramaMapView {...CAMERA} mapStyle="satellite" showsTraffic />);
    expect(view.toJSON()).toMatchObject({ props: { mapStyle: 'hybrid', showsTraffic: true } });

    // Traffic off: back to the imagery with nothing on top.
    view.rerender(<DioramaMapView {...CAMERA} mapStyle="satellite" />);
    expect(view.toJSON()).toMatchObject({ props: { mapStyle: 'satellite', showsTraffic: false } });
  });

  it.each([
    ['satellite', false, 'satellite'],
    ['satellite', true, 'hybrid'],
    ['hybrid', false, 'hybrid'],
    ['hybrid', true, 'hybrid'],
    ['standard', false, 'standard'],
    ['standard', true, 'standard'],
  ] as const)('shows %s with traffic %s as %s', (style, traffic, shown) => {
    expect(mapStyleShown(style, traffic)).toBe(shown);
  });

  it('passes head position props to the native view', () => {
    const view = render(<DioramaMapView {...CAMERA} headTracking headPosition leanGain={2.5} />);
    expect(view.toJSON()).toMatchObject({
      props: { headTracking: true, headPosition: true, leanGain: 2.5 },
    });
  });

  it('unwraps the native onHeadPositionState event', () => {
    const onHeadPositionState = jest.fn();
    const view = render(
      <DioramaMapView
        {...CAMERA}
        headTracking
        headPosition
        onHeadPositionState={onHeadPositionState}
      />,
    );
    const native = view.UNSAFE_getByType(NativeDioramaMapView);
    for (const state of ['starting', 'tracking', 'limited', 'off'] as const) {
      fireEvent(native, 'headPositionState', { nativeEvent: { state, target: 42 } });
    }
    expect(onHeadPositionState.mock.calls).toEqual([
      [{ state: 'starting' }],
      [{ state: 'tracking' }],
      [{ state: 'limited' }],
      [{ state: 'off' }],
    ]);
  });

  it('leaves true north off by default, and passes it on when asked (live mode)', () => {
    expect(render(<DioramaMapView {...CAMERA} headTracking />).toJSON()).toMatchObject({
      props: { trueNorth: false },
    });
    expect(render(<DioramaMapView {...CAMERA} headTracking trueNorth />).toJSON()).toMatchObject({
      props: { headTracking: true, trueNorth: true, heading: CAMERA.heading },
    });
  });

  it('unwraps the native onCompassState event', () => {
    const onCompassState = jest.fn();
    const view = render(
      <DioramaMapView {...CAMERA} headTracking trueNorth onCompassState={onCompassState} />,
    );
    const native = view.UNSAFE_getByType(NativeDioramaMapView);
    for (const state of ['calibrating', 'good', 'unavailable'] as const) {
      fireEvent(native, 'compassState', { nativeEvent: { state, target: 42 } });
    }
    expect(onCompassState.mock.calls).toEqual([
      [{ state: 'calibrating' }],
      [{ state: 'good' }],
      [{ state: 'unavailable' }],
    ]);
  });

  it('asks for head position stats only when someone listens', () => {
    const quiet = render(<DioramaMapView {...CAMERA} headTracking headPosition />);
    expect(quiet.UNSAFE_getByType(NativeDioramaMapView).props.onHeadPositionStats).toBeUndefined();

    const onHeadPositionStats = jest.fn();
    const view = render(
      <DioramaMapView
        {...CAMERA}
        headTracking
        headPosition
        onHeadPositionStats={onHeadPositionStats}
      />,
    );
    const stats = {
      framesPerSecond: 60,
      poseAgeMs: 31,
      predictionErrorMm: 0.4,
      jitterMm: 0.1,
      move: { right: 0, up: -0.2, forward: 0 },
      lean: { right: 0, up: -75, forward: 0 },
      metersPerMeter: 375,
      height: 525,
      distance: 1050,
    };
    fireEvent(view.UNSAFE_getByType(NativeDioramaMapView), 'headPositionStats', {
      nativeEvent: stats,
    });
    expect(onHeadPositionStats).toHaveBeenCalledWith(stats);
  });

  it("hides Apple's location dot unless asked, and passes it on when asked", () => {
    expect(render(<DioramaMapView {...CAMERA} />).toJSON()).toMatchObject({
      props: { showsUserLocation: false },
    });
    expect(render(<DioramaMapView {...CAMERA} showsUserLocation />).toJSON()).toMatchObject({
      props: { showsUserLocation: true },
    });
  });

  it('leaves head tracking off by default', () => {
    const view = render(<DioramaMapView {...CAMERA} />);
    expect(view.toJSON()).toMatchObject({
      props: { headTracking: false, debugLook: false, trackingSensitivity: 1 },
    });
  });

  it('passes head tracking props to the native view', () => {
    const view = render(
      <DioramaMapView {...CAMERA} headTracking debugLook trackingSensitivity={1.5} />,
    );
    expect(view.toJSON()).toMatchObject({
      props: { ...CAMERA, headTracking: true, debugLook: true, trackingSensitivity: 1.5 },
    });
  });

  it('defaults to mono at eye separation 1, for a Cardboard v2 viewer', () => {
    const view = render(<DioramaMapView {...CAMERA} />);
    expect(view.toJSON()).toMatchObject({
      props: { mode: 'mono', eyeSeparation: 1, lensSpacing: 64 },
    });
  });

  it('defaults to round eye windows 35 mm across, filling a 35 mm lens hole', () => {
    const view = render(<DioramaMapView {...CAMERA} mode="stereo" />);
    expect(view.toJSON()).toMatchObject({ props: { windowDiameter: DEFAULT_WINDOW_DIAMETER } });
    expect(DEFAULT_WINDOW_DIAMETER).toBe(35);
  });

  it('passes the viewer fit to the native view, as a diameter only', () => {
    const view = render(
      <DioramaMapView {...CAMERA} mode="stereo" lensSpacing={60} windowDiameter={30} />,
    );
    const props = view.UNSAFE_getByType(NativeDioramaMapView).props;
    expect(props).toMatchObject({ mode: 'stereo', lensSpacing: 60, windowDiameter: 30 });
    expect(props).not.toHaveProperty('windowWidth');
    expect(props).not.toHaveProperty('windowHeight');
  });

  it('passes stereo props to the native view', () => {
    const view = render(
      <DioramaMapView {...CAMERA} mode="stereo" eyeSeparation={2} debugThermalState="serious" />,
    );
    expect(view.toJSON()).toMatchObject({
      props: { mode: 'stereo', eyeSeparation: 2, debugThermalState: 'serious' },
    });
  });

  it('leaves the miniature look off by default', () => {
    const view = render(<DioramaMapView {...CAMERA} />);
    expect(view.toJSON()).toMatchObject({ props: { miniatureIntensity: 0 } });
  });

  it('passes the miniature intensity to the native view', () => {
    const view = render(<DioramaMapView {...CAMERA} mode="stereo" miniatureIntensity={0.6} />);
    expect(view.toJSON()).toMatchObject({ props: { mode: 'stereo', miniatureIntensity: 0.6 } });
  });

  it('unwraps the native onDegraded event', () => {
    const onDegraded = jest.fn();
    const view = render(<DioramaMapView {...CAMERA} mode="stereo" onDegraded={onDegraded} />);
    fireEvent(view.UNSAFE_getByType(NativeDioramaMapView), 'degraded', {
      nativeEvent: { reason: 'thermal' },
    });
    expect(onDegraded).toHaveBeenCalledWith({ reason: 'thermal' });
  });

  it('unwraps the native onEyeLayout event', () => {
    const onEyeLayout = jest.fn();
    const view = render(<DioramaMapView {...CAMERA} mode="stereo" onEyeLayout={onEyeLayout} />);
    fireEvent(view.UNSAFE_getByType(NativeDioramaMapView), 'eyeLayout', {
      nativeEvent: { ...STEREO_LAYOUT, target: 42 },
    });
    expect(onEyeLayout).toHaveBeenCalledWith(STEREO_LAYOUT);
  });

  it('shares the stereo eye windows until the map goes mono or away', () => {
    const eyes = renderHook(() => useStereoEyes());
    const view = render(<DioramaMapView {...CAMERA} mode="stereo" />);
    const native = () => view.UNSAFE_getByType(NativeDioramaMapView);
    expect(eyes.result.current).toBeNull();

    act(() => fireEvent(native(), 'eyeLayout', { nativeEvent: STEREO_LAYOUT }));
    expect(eyes.result.current).toEqual({ left: STEREO_LAYOUT.left, right: STEREO_LAYOUT.right });

    act(() => fireEvent(native(), 'eyeLayout', { nativeEvent: MONO_LAYOUT }));
    expect(eyes.result.current).toBeNull();

    act(() => fireEvent(native(), 'eyeLayout', { nativeEvent: STEREO_LAYOUT }));
    // A mono map elsewhere (say, the preview underneath) leaves them alone.
    const preview = render(<DioramaMapView {...CAMERA} />);
    act(() =>
      fireEvent(preview.UNSAFE_getByType(NativeDioramaMapView), 'eyeLayout', {
        nativeEvent: MONO_LAYOUT,
      }),
    );
    expect(eyes.result.current).not.toBeNull();

    act(() => view.unmount());
    expect(eyes.result.current).toBeNull();
  });

  it.each([
    ['yes', 'Midtown Manhattan', CAMERA.center],
    ['no', 'Dubai', { latitude: 25.1972, longitude: 55.2744 }],
    ['unknown', 'Reykjavík', { latitude: 64.1466, longitude: -21.9426 }],
  ])('reports 3D coverage "%s" for %s in onReady', (coverage, _place, center) => {
    const onReady = jest.fn();
    const view = render(
      <DioramaMapView {...CAMERA} center={center} mode="stereo" onReady={onReady} />,
    );
    fireEvent(view.UNSAFE_getByType(NativeDioramaMapView), 'ready', {
      nativeEvent: { mode: 'stereo' },
    });
    expect(onReady).toHaveBeenCalledWith({ coverage, mode: 'stereo' });
  });
});
