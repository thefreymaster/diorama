import { act, renderHook } from '@testing-library/react-native';

import { resetSettings, setCameraHeight } from '@/features/settings/store';

import { CAMERA_DISTANCE, cameraAltitude, useCameraAltitude } from '../cameraHeight';

afterEach(() => {
  act(() => resetSettings());
});

describe('cameraAltitude', () => {
  it("keeps a place's own framing at 1×", () => {
    expect(cameraAltitude(1000, 1)).toBe(1000);
    expect(cameraAltitude(700, 1)).toBe(700);
    expect(cameraAltitude(3000, 1)).toBe(3000);
  });

  it('moves the camera closer or farther by the multiplier', () => {
    expect(cameraAltitude(1000, 0.5)).toBe(500);
    expect(cameraAltitude(1000, 2)).toBe(2000);
    expect(cameraAltitude(1200, 1.5)).toBeCloseTo(1800);
  });

  it('never goes nearer than 300 m or farther than 5 km', () => {
    expect(CAMERA_DISTANCE).toEqual({ min: 300, max: 5000 });
    // An address (700 m) at the lowest setting would be 280 m.
    expect(cameraAltitude(700, 0.4)).toBe(300);
    // A big city (3 km) at the highest would be 9 km.
    expect(cameraAltitude(3000, 3)).toBe(5000);
    expect(cameraAltitude(1700, 3)).toBe(5000);
    // Exactly at the ends is fine.
    expect(cameraAltitude(750, 0.4)).toBe(300);
    expect(cameraAltitude(2500, 2)).toBe(5000);
  });
});

describe('useCameraAltitude', () => {
  it('follows the Camera height setting live', () => {
    const { result } = renderHook(() => useCameraAltitude(1000));
    expect(result.current).toBe(1000);

    act(() => setCameraHeight(0.5));
    expect(result.current).toBe(500);

    act(() => setCameraHeight(2));
    expect(result.current).toBe(2000);

    act(() => resetSettings());
    expect(result.current).toBe(1000);
  });

  it('applies the same limits as cameraAltitude', () => {
    act(() => setCameraHeight(3));
    const { result } = renderHook(() => useCameraAltitude(2000));

    expect(result.current).toBe(5000);
  });
});
