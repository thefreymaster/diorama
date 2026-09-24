import { renderHook } from '@testing-library/react-native';
import type { RefObject } from 'react';

import type { DioramaMapViewRef } from '@diorama/native';

import { LOOK_DEGREES_PER_POINT, useLookDrag } from '../useLookDrag';
import { usePinchZoom } from '../usePinchZoom';

/** A map ref whose methods are all mocks. */
function mockMap(): { current: DioramaMapViewRef } {
  return {
    current: {
      recenter: jest.fn(() => Promise.resolve()),
      setDebugLook: jest.fn((_dx: number, _dy: number) => Promise.resolve()),
      beginZoom: jest.fn(() => Promise.resolve()),
      setZoom: jest.fn((_scale: number) => Promise.resolve()),
      endZoom: jest.fn(() => Promise.resolve()),
      resetZoom: jest.fn(() => Promise.resolve()),
      followTo: jest.fn((_latitude: number, _longitude: number) => Promise.resolve()),
    },
  };
}

/** The pinch and the drag, wired together as the Viewer wires them. */
function renderGestures(map: RefObject<DioramaMapViewRef | null>) {
  return renderHook(() => {
    const pinch = usePinchZoom(map);
    const drag = useLookDrag(map, pinch.isPinching);
    return { pinch, drag };
  }).result;
}

describe('usePinchZoom', () => {
  it('passes each step of a pinch to the map, counting from where it took hold', () => {
    const map = mockMap();
    const { pinch } = renderGestures(map).current;

    pinch.handlers.onStart(1.2);
    pinch.handlers.onPinch(1.2);
    pinch.handlers.onPinch(2.4);
    pinch.handlers.onPinch(0.6);
    pinch.handlers.onEnd();

    expect(map.current.beginZoom).toHaveBeenCalledTimes(1);
    expect(jest.mocked(map.current.setZoom).mock.calls).toEqual([[1], [2], [0.5]]);
    expect(map.current.endZoom).toHaveBeenCalledTimes(1);
  });

  it('holds the look still while a pinch has the fingers, then drags on from there', () => {
    const map = mockMap();
    const { pinch, drag } = renderGestures(map).current;
    const lastLook = () => jest.mocked(map.current.setDebugLook).mock.lastCall;

    drag.handlers.onStart();
    drag.handlers.onDrag(-40, 0);
    expect(lastLook()).toEqual([40 * LOOK_DEGREES_PER_POINT, 0]);

    // A second finger lands and pinches: the first one moves with it.
    pinch.handlers.onStart(1);
    drag.handlers.onDrag(-90, 30);
    pinch.handlers.onPinch(1.5);
    drag.handlers.onDrag(-140, 60);
    expect(map.current.setDebugLook).toHaveBeenCalledTimes(1);

    // It lifts; the drag carries on from where the finger is, with no jump.
    pinch.handlers.onEnd();
    drag.handlers.onDrag(-150, 60);
    expect(lastLook()).toEqual([40 * LOOK_DEGREES_PER_POINT, 0]);
    drag.handlers.onDrag(-170, 64);
    expect(lastLook()).toEqual([60 * LOOK_DEGREES_PER_POINT, 4 * LOOK_DEGREES_PER_POINT]);
  });

  it('lets go of a pinch cut short, once, and ignores its late moves', () => {
    const map = mockMap();
    const { pinch, drag } = renderGestures(map).current;

    pinch.handlers.onStart(1);
    pinch.release();
    pinch.handlers.onPinch(3);
    pinch.handlers.onEnd();

    expect(map.current.endZoom).toHaveBeenCalledTimes(1);
    expect(map.current.setZoom).not.toHaveBeenCalled();
    // The drag isn't left holding still.
    drag.handlers.onStart();
    drag.handlers.onDrag(-8, 0);
    expect(map.current.setDebugLook).toHaveBeenLastCalledWith(8 * LOOK_DEGREES_PER_POINT, 0);
  });

  it('resets to the normal distance, dropping any pinch', () => {
    const map = mockMap();
    const { pinch } = renderGestures(map).current;

    pinch.handlers.onStart(1);
    pinch.reset();
    pinch.handlers.onPinch(2);

    expect(map.current.resetZoom).toHaveBeenCalledTimes(1);
    expect(map.current.setZoom).not.toHaveBeenCalled();
    expect(pinch.isPinching()).toBe(false);
  });

  it('zooms a whole step at once, but not over a pinch', () => {
    const map = mockMap();
    const { pinch } = renderGestures(map).current;

    pinch.handlers.zoomBy(2);
    expect(map.current.beginZoom).toHaveBeenCalledTimes(1);
    expect(map.current.setZoom).toHaveBeenLastCalledWith(2);
    expect(map.current.endZoom).toHaveBeenCalledTimes(1);

    pinch.handlers.onStart(1);
    pinch.handlers.zoomBy(0.5);
    expect(map.current.setZoom).toHaveBeenCalledTimes(1);
  });
});
