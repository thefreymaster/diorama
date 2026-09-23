import { act, fireEvent, render, renderHook } from '@testing-library/react-native';
import { createRef } from 'react';

import {
  DEFAULT_WINDOW_DIAMETER,
  DioramaMapView,
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

  it('reports flyover coverage in onReady', () => {
    const onReady = jest.fn();
    const view = render(<DioramaMapView {...CAMERA} mode="stereo" onReady={onReady} />);
    fireEvent(view.UNSAFE_getByType(NativeDioramaMapView), 'ready', { nativeEvent: {} });
    expect(onReady).toHaveBeenCalledWith({ flyoverAvailable: true });
  });
});
