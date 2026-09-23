import { act, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import Animated, { getAnimatedStyle } from 'react-native-reanimated';

import { useMapReveal } from '../useMapReveal';

const FRAME_MS = 16;

function Cover({ isReady }: { isReady: boolean }) {
  const style = useMapReveal(isReady);
  return <Animated.View testID="cover" style={style} />;
}

function coverOpacity(): number {
  return (getAnimatedStyle(screen.getByTestId('cover')) as { opacity: number }).opacity;
}

/** The cover's opacity, frame by frame, for `ms` after the map is ready. */
async function revealFrames(ms: number): Promise<number[]> {
  const { rerender } = render(<Cover isReady={false} />);
  await act(async () => {});
  expect(coverOpacity()).toBe(1);

  rerender(<Cover isReady />);
  const frames: number[] = [];
  for (let elapsed = 0; elapsed < ms; elapsed += FRAME_MS) {
    act(() => jest.advanceTimersByTime(FRAME_MS));
    frames.push(coverOpacity());
  }
  return frames;
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('useMapReveal', () => {
  it('stays covered until the map is ready, then dissolves away', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);

    const frames = await revealFrames(2000);

    expect(frames[0]).toBeGreaterThan(0);
    expect(frames[0]).toBeLessThan(1);
    expect(frames.at(-1)).toBeCloseTo(0, 2);
  });

  it('still dissolves under Reduce Motion, but eases out with no overshoot', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);

    const frames = await revealFrames(2000);

    // A fade, not a pop: the first frame is partway.
    expect(frames[0]).toBeGreaterThan(0);
    expect(frames[0]).toBeLessThan(1);
    // Only ever heading down, and never past fully clear.
    frames.forEach((opacity, index) => {
      expect(opacity).toBeGreaterThanOrEqual(0);
      if (index > 0) expect(opacity).toBeLessThanOrEqual(frames[index - 1]!);
    });
    expect(frames.at(-1)).toBeCloseTo(0, 2);
  });
});
