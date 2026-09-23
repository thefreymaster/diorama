import { useWindowDimensions } from 'react-native';

/**
 * Glyphs and tiles grow with Dynamic Type, but less than text does at the
 * accessibility sizes: past this multiplier they would crowd the text out.
 */
export const MAX_GLYPH_SCALE = 1.6;

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
