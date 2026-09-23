import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { BlurView } from 'expo-blur';
import { GlassView } from 'expo-glass-effect';
import { getAnimatedStyle, useReducedMotion } from 'react-native-reanimated';
import type { ReactTestInstance } from 'react-test-renderer';

import { PRESSED_SCALE } from '@/theme';

import { GlassButton } from '../GlassButton';
import { GlassSurface } from '../GlassSurface';
import { canUseLiquidGlass } from '../liquidGlass';
import { PrimaryButton } from '../PrimaryButton';
import { SkeletonRow } from '../SkeletonRow';

// The two things these primitives adapt to: the Reduce Motion setting and
// whether the iPhone has iOS 26 Liquid Glass.
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  ...jest.requireActual('react-native-reanimated'),
  useReducedMotion: jest.fn(() => false),
}));
jest.mock('../liquidGlass', () => ({ canUseLiquidGlass: jest.fn(() => false) }));

const mockReduceMotion = jest.mocked(useReducedMotion);
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

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
  mockReduceMotion.mockReturnValue(false);
  mockLiquidGlass.mockReturnValue(false);
});

describe('press feedback', () => {
  it('springs a button down while pressed and back up on release', () => {
    render(<PrimaryButton title="Enter Diorama" onPress={() => {}} />);
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

  it('dims instead of moving when Reduce Motion is on', () => {
    mockReduceMotion.mockReturnValue(true);
    render(<PrimaryButton title="Enter Diorama" onPress={() => {}} />);
    const button = screen.getByRole('button');

    // No spring: the change lands in full on the next frame.
    fireEvent(button, 'pressIn');
    advance(FRAME_MS);
    expect(look(button)).toEqual({ opacity: 0.7, scale: 1 });

    fireEvent(button, 'pressOut');
    advance(FRAME_MS);
    expect(look(button)).toEqual({ opacity: 1, scale: 1 });
  });

  it('shrinks a glass button before iOS 26', () => {
    render(<GlassButton symbol="scope" accessibilityLabel="Recenter" onPress={() => {}} />);
    const button = screen.getByRole('button');

    fireEvent(button, 'pressIn');
    advance(1000);

    expect(look(button).scale).toBeCloseTo(PRESSED_SCALE);
  });

  it('leaves the press effect to Liquid Glass itself on iOS 26', () => {
    mockLiquidGlass.mockReturnValue(true);
    render(<GlassButton symbol="scope" accessibilityLabel="Recenter" onPress={() => {}} />);
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

  it('breathes while loading', () => {
    render(<SkeletonRow icon={false} subtitle={false} />);

    advance(600);

    expect(look(firstBar()).opacity).toBeLessThan(0.9);
  });

  it('holds still when Reduce Motion is on', () => {
    mockReduceMotion.mockReturnValue(true);
    render(<SkeletonRow icon={false} subtitle={false} />);

    advance(2000);

    expect(look(firstBar()).opacity).toBe(1);
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
