import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { BlurView } from 'expo-blur';
import { GlassView } from 'expo-glass-effect';
import { SymbolView } from 'expo-symbols';
import { Dimensions, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { DioramaRect, DioramaStereoEyes } from '@diorama/native';
import { colors } from '@/theme';
import { canUseLiquidGlass } from '@/ui/liquidGlass';

import { ExitButton } from '../ExitButton';
import { exitButtonOrigin } from '../useExitButtonOrigin';

let mockStereoEyes: DioramaStereoEyes | null = null;

jest.mock('@diorama/native', () => ({
  ...jest.requireActual<object>('@diorama/native'),
  useStereoEyes: () => mockStereoEyes,
}));

jest.mock('@/ui/liquidGlass', () => ({ canUseLiquidGlass: jest.fn(() => true) }));

const mockLiquidGlass = jest.mocked(canUseLiquidGlass);

const SIZE = 44;
// An iPhone 14 Pro in landscape: 852 × 393 pt, the sensor housing on one
// side and the home indicator below. Lens centers at x = 232.83 / 619.17,
// y = 196.5 (64 mm apart at 6.04 pt per mm).
const INSETS = { top: 0, left: 59, right: 59, bottom: 21 };
const FRAME = { x: 0, y: 0, width: 852, height: 393 };
const HIDDEN = { includeHiddenElements: true };

/** Each eye's window, `width` × `height` pt, centered on its lens. */
function eyes(width: number, height: number): DioramaStereoEyes {
  const at = (centerX: number): DioramaRect => ({
    x: centerX - width / 2,
    y: 196.5 - height / 2,
    width,
    height,
  });
  return { left: at(232.83), right: at(619.17) };
}

/** T24's default 33 × 42 mm windows. */
const WINDOWS = eyes(199, 253);
/** T26's default 35-mm circles (the squares around them). */
const CIRCLES = eyes(211.28, 211.28);
/** Settings' widest, tallest windows (40 × 60 mm, capped by the screen). */
const TALL_WINDOWS = eyes(241.46, 381);
/** Settings' largest circles (45 mm). */
const BIG_CIRCLES = eyes(271.64, 271.64);

function overlaps(a: DioramaRect, b: DioramaRect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/** The button's square at `origin`, grown by `by` on every side. */
function square(origin: { x: number; y: number }, by = 0): DioramaRect {
  return { x: origin.x - by, y: origin.y - by, width: SIZE + 2 * by, height: SIZE + 2 * by };
}

// Jest's window reports a larger text size; tests start at the default (Large).
const jestFontScale = Dimensions.get('window').fontScale;

function setFontScale(fontScale: number) {
  act(() =>
    Dimensions.set({
      window: { ...Dimensions.get('window'), fontScale },
      screen: Dimensions.get('screen'),
    }),
  );
}

beforeEach(() => {
  mockStereoEyes = null;
  mockLiquidGlass.mockReturnValue(true);
  setFontScale(1);
});

afterEach(() => setFontScale(jestFontScale));

describe('exitButtonOrigin', () => {
  it('sits 16 pt into the safe area from its top-left corner', () => {
    expect(exitButtonOrigin(SIZE, INSETS, null)).toEqual({ x: 75, y: 16 });
    expect(exitButtonOrigin(SIZE, INSETS, WINDOWS)).toEqual({ x: 75, y: 16 });
    expect(exitButtonOrigin(SIZE, INSETS, CIRCLES)).toEqual({ x: 75, y: 16 });
  });

  it.each([
    ['default windows', WINDOWS],
    ['default circles', CIRCLES],
    ['tall windows', TALL_WINDOWS],
    ['big circles', BIG_CIRCLES],
  ])('keeps black between it and both eyes, inside the safe area (%s)', (_name, windows) => {
    const origin = exitButtonOrigin(SIZE, INSETS, windows);

    for (const eye of [windows.left, windows.right]) {
      expect(overlaps(square(origin, 8), eye)).toBe(false);
    }
    expect(origin.x).toBeGreaterThanOrEqual(INSETS.left);
    expect(origin.y).toBeGreaterThanOrEqual(INSETS.top);
  });

  it('slides left, beside the left eye, when a tall window reaches the corner', () => {
    const origin = exitButtonOrigin(SIZE, INSETS, TALL_WINDOWS);

    expect(origin.y).toBe(16);
    expect(origin.x).toBeCloseTo(TALL_WINDOWS.left.x - 8 - SIZE, 5);
  });

  it('slides up, above the left eye, when there is no room beside it', () => {
    const origin = exitButtonOrigin(SIZE, INSETS, BIG_CIRCLES);

    expect(origin.x).toBe(75);
    expect(origin.y).toBeCloseTo(BIG_CIRCLES.left.y - 8 - SIZE, 5);
  });

  it('makes room for a bigger button (larger text sizes)', () => {
    const origin = exitButtonOrigin(70, INSETS, CIRCLES);

    const frame = { x: origin.x, y: origin.y, width: 70, height: 70 };
    expect(overlaps(frame, CIRCLES.left)).toBe(false);
    expect(origin.y).toBeGreaterThanOrEqual(0);
  });

  it('stays in the corner when the windows leave no room at all', () => {
    const everywhere = { x: 0, y: 0, width: 852, height: 393 };

    expect(exitButtonOrigin(SIZE, INSETS, { left: everywhere, right: everywhere })).toEqual({
      x: 75,
      y: 16,
    });
  });
});

describe('ExitButton', () => {
  function renderButton(visible = true) {
    const onPress = jest.fn();
    render(
      <SafeAreaProvider initialMetrics={{ frame: FRAME, insets: INSETS }}>
        <ExitButton visible={visible} onPress={onPress} />
      </SafeAreaProvider>,
    );
    return onPress;
  }

  function frame() {
    return StyleSheet.flatten(screen.getByTestId('viewer-exit', HIDDEN).props.style);
  }

  it('is a 44-pt round button VoiceOver calls Exit', () => {
    const onPress = renderButton();

    const button = screen.getByRole('button', { name: 'Exit' });
    fireEvent.press(button);

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(frame()).toMatchObject({ position: 'absolute', width: 44, height: 44 });
  });

  it('keeps out of the eye windows the map reports', () => {
    mockStereoEyes = BIG_CIRCLES;
    renderButton();

    const { left, top } = frame();
    const origin = { x: Number(left), y: Number(top) };
    expect(origin).toEqual(exitButtonOrigin(SIZE, INSETS, BIG_CIRCLES));
    expect(overlaps(square(origin), BIG_CIRCLES.left)).toBe(false);
  });

  it('grows with the text size, and still keeps out of the eyes', () => {
    mockStereoEyes = CIRCLES;
    setFontScale(3); // AX5: capped at 1.6×
    renderButton();

    const { left, top, width, height } = frame();
    const box = { x: Number(left), y: Number(top), width: Number(width), height: Number(height) };
    expect(box).toMatchObject({ width: 70, height: 70 });
    expect(overlaps(box, CIRCLES.left)).toBe(false);
    expect(box.x).toBeGreaterThanOrEqual(INSETS.left);
  });

  it('uses dark glass and a white glyph, since it sits over black', () => {
    renderButton();

    expect(screen.UNSAFE_getByType(GlassView).props).toMatchObject({
      colorScheme: 'dark',
      isInteractive: true,
    });
    expect(screen.UNSAFE_getByType(SymbolView).props).toMatchObject({
      name: 'xmark',
      tintColor: colors.onTint,
    });
  });

  it('falls back to the dark blur material before iOS 26', () => {
    mockLiquidGlass.mockReturnValue(false);
    renderButton();

    expect(screen.UNSAFE_getByType(BlurView).props).toMatchObject({ tint: 'systemMaterialDark' });
  });

  it('hides from VoiceOver and lets touches through while hidden', () => {
    renderButton(false);

    expect(screen.queryByRole('button', { name: 'Exit' })).toBeNull();
    expect(frame()).toMatchObject({ pointerEvents: 'none' });
  });
});
