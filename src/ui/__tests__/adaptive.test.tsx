import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { BlurView } from 'expo-blur';
import { GlassView } from 'expo-glass-effect';
import type { ReactElement } from 'react';
import { AccessibilityInfo } from 'react-native';
import { getAnimatedStyle } from 'react-native-reanimated';
import type { ReactTestInstance } from 'react-test-renderer';

import { PRESSED_SCALE } from '@/theme';

import { GlassButton } from '../GlassButton';
import { GlassSurface } from '../GlassSurface';
import { canUseLiquidGlass } from '../liquidGlass';
import { PrimaryButton } from '../PrimaryButton';
import { SkeletonRow } from '../SkeletonRow';

// The two things these primitives adapt to: the Reduce Motion setting (read
// from iOS below) and whether the iPhone has iOS 26 Liquid Glass.
jest.mock('../liquidGlass', () => ({ canUseLiquidGlass: jest.fn(() => false) }));

const mockLiquidGlass = jest.mocked(canUseLiquidGlass);

const FRAME_MS = 17;

type AnimatedLook = { opacity?: number; transform?: { scale?: number }[] };

function look(element: ReactTestInstance): { opacity: number; scale: number } {
  const style = getAnimatedStyle(element) as AnimatedLook;
  return { opacity: style.opacity ?? 1, scale: style.transform?.[0]?.scale ?? 1 };
}

function advance(ms: number) {
  act(() => {
    jest.advanceTimersByTime(ms);
  });
}

/** What iOS reports for Reduce Motion when asked. */
let systemReduceMotion = false;
/** iOS's "Reduce Motion changed" callback, so a test can flip the setting live. */
let reduceMotionListener: ((enabled: boolean) => void) | undefined;

beforeEach(() => {
  jest.useFakeTimers();
  systemReduceMotion = false;
  reduceMotionListener = undefined;
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockImplementation(() => Promise.resolve(systemReduceMotion));
  const addEventListener = (event: string, listener: (enabled: boolean) => void) => {
    if (event === 'reduceMotionChanged') reduceMotionListener = listener;
    return { remove: jest.fn() };
  };
  jest
    .spyOn(AccessibilityInfo, 'addEventListener')
    .mockImplementation(addEventListener as unknown as typeof AccessibilityInfo.addEventListener);
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  mockLiquidGlass.mockReturnValue(false);
});

/** Renders, then lets the Reduce Motion check (a promise) come back from iOS. */
async function renderSettled(element: ReactElement) {
  render(element);
  await act(async () => {});
}

/** The user flips Reduce Motion in Settings while the app runs. */
function setReduceMotion(enabled: boolean) {
  act(() => reduceMotionListener?.(enabled));
}

describe('press feedback', () => {
  it('springs a button down while pressed and back up on release', async () => {
    await renderSettled(<PrimaryButton title="Enter Mini City" onPress={() => {}} />);
    const button = screen.getByRole('button');

    fireEvent(button, 'pressIn');
    // A spring, not a jump: nothing has moved before the first frame.
    expect(look(button).scale).toBe(1);
    advance(1000);
    expect(look(button).scale).toBeCloseTo(PRESSED_SCALE);

    fireEvent(button, 'pressOut');
    advance(1000);
    expect(look(button).scale).toBeCloseTo(1);
  });

  it('dims instead of moving when Reduce Motion is on', async () => {
    systemReduceMotion = true;
    await renderSettled(<PrimaryButton title="Enter Mini City" onPress={() => {}} />);
    const button = screen.getByRole('button');

    // No spring: the change lands in full on the next frame.
    fireEvent(button, 'pressIn');
    advance(FRAME_MS);
    expect(look(button)).toEqual({ opacity: 0.7, scale: 1 });

    fireEvent(button, 'pressOut');
    advance(FRAME_MS);
    expect(look(button)).toEqual({ opacity: 1, scale: 1 });
  });

  it('follows Reduce Motion turned on and off while the app runs', async () => {
    await renderSettled(<PrimaryButton title="Enter Mini City" onPress={() => {}} />);
    const button = screen.getByRole('button');

    setReduceMotion(true);
    fireEvent(button, 'pressIn');
    advance(FRAME_MS);
    expect(look(button)).toEqual({ opacity: 0.7, scale: 1 });
    fireEvent(button, 'pressOut');
    advance(FRAME_MS);

    setReduceMotion(false);
    fireEvent(button, 'pressIn');
    advance(1000);
    expect(look(button).scale).toBeCloseTo(PRESSED_SCALE);
  });

  it('shrinks a glass button before iOS 26', async () => {
    await renderSettled(
      <GlassButton symbol="scope" accessibilityLabel="Recenter" onPress={() => {}} />,
    );
    const button = screen.getByRole('button');

    fireEvent(button, 'pressIn');
    advance(1000);

    expect(look(button).scale).toBeCloseTo(PRESSED_SCALE);
  });

  it('leaves the press effect to Liquid Glass itself on iOS 26', async () => {
    mockLiquidGlass.mockReturnValue(true);
    await renderSettled(
      <GlassButton symbol="scope" accessibilityLabel="Recenter" onPress={() => {}} />,
    );
    const button = screen.getByRole('button');

    fireEvent(button, 'pressIn');
    advance(1000);

    expect(look(button)).toEqual({ opacity: 1, scale: 1 });
  });
});

describe('loading pulse', () => {
  function firstBar(): ReactTestInstance {
    const [bar] = screen
      .getByLabelText('Loading')
      .findAll(
        (node) => typeof node.type === 'string' && node.props.jestAnimatedStyle !== undefined,
      );
    if (!bar) throw new Error('SkeletonRow has no animated bar');
    return bar;
  }

  it('breathes while loading', async () => {
    await renderSettled(<SkeletonRow icon={false} subtitle={false} />);

    advance(600);

    expect(look(firstBar()).opacity).toBeLessThan(0.9);
  });

  it('holds still when Reduce Motion is on', async () => {
    systemReduceMotion = true;
    await renderSettled(<SkeletonRow icon={false} subtitle={false} />);

    advance(2000);

    expect(look(firstBar()).opacity).toBe(1);
  });

  it('stops mid-breath, fully shown, when Reduce Motion is turned on', async () => {
    await renderSettled(<SkeletonRow icon={false} subtitle={false} />);
    advance(600);
    expect(look(firstBar()).opacity).toBeLessThan(0.9);

    setReduceMotion(true);
    advance(FRAME_MS);
    expect(look(firstBar()).opacity).toBe(1);
    advance(2000);
    expect(look(firstBar()).opacity).toBe(1);

    setReduceMotion(false);
    advance(600);
    expect(look(firstBar()).opacity).toBeLessThan(0.9);
  });
});

describe('GlassSurface', () => {
  it('uses Liquid Glass on iOS 26', () => {
    mockLiquidGlass.mockReturnValue(true);

    render(<GlassSurface />);

    expect(screen.UNSAFE_queryByType(GlassView)).not.toBeNull();
    expect(screen.UNSAFE_queryByType(BlurView)).toBeNull();
  });

  it('falls back to the system blur material before iOS 26', () => {
    render(<GlassSurface />);

    expect(screen.UNSAFE_getByType(BlurView).props).toMatchObject({ tint: 'systemMaterial' });
    expect(screen.UNSAFE_queryByType(GlassView)).toBeNull();
  });
});
