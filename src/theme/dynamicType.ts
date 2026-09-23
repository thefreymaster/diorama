import { useWindowDimensions } from 'react-native';

/**
 * Glyphs and tiles grow with Dynamic Type, but less than text does at the
 * accessibility sizes: past this multiplier they would crowd the text out.
 */
export const MAX_GLYPH_SCALE = 1.6;

/**
 * Text-size multiplier past the largest standard size (XXXL, about 1.35):
 * from here on the accessibility sizes begin, and layouts that sit side by
 * side stack instead, as UIKit's list cells do.
 */
export const ACCESSIBILITY_FONT_SCALE = 1.4;

/** True at the accessibility text sizes (AX1 and up), where rows stack their parts. */
export function useIsAccessibilitySize(): boolean {
  const { fontScale } = useWindowDimensions();
  return fontScale >= ACCESSIBILITY_FONT_SCALE;
}

/** Scale a size given at the default text size by the user's text-size multiplier. */
export function scaleForDynamicType(
  size: number,
  fontScale: number,
  maxScale: number = MAX_GLYPH_SCALE,
): number {
  const scale = Math.min(Math.max(fontScale, 0), maxScale);
  return Math.round(size * scale);
}

/**
 * A non-text size (symbol, icon tile, control height) that follows Dynamic Type.
 * Re-renders when the user changes their text size.
 */
export function useScaledSize(size: number, maxScale: number = MAX_GLYPH_SCALE): number {
  const { fontScale } = useWindowDimensions();
  return scaleForDynamicType(size, fontScale, maxScale);
}
