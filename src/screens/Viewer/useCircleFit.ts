import { useState } from 'react';
import type { LayoutChangeEvent, ViewStyle } from 'react-native';

import { spacing } from '@/theme';

/** Room kept between a HUD's corners and the edge of its eye's circle. */
export const CIRCLE_MARGIN = spacing.sm;

/**
 * How wide a HUD may grow in a circle, as a share of its diameter. A tile a
 * bit wider than tall (like the countdown's) just fits at about this width,
 * so text wraps there into a block that suits a circle.
 */
const WIDTH_SHARE = 0.8;

type Size = { width: number; height: number };

/** The widest a HUD gets in a circle of `diameter`, so its text wraps rather than overflows. */
export function circleContentWidth(diameter: number): number {
  return Math.floor(diameter * WIDTH_SHARE);
}

/**
 * The scale that keeps a box of `size`, centered in a circle of `diameter`,
 * inside it: 1 when its corners (half its diagonal out from the center)
 * already clear the edge by `CIRCLE_MARGIN`, less when they don't.
 */
export function circleFitScale({ width, height }: Size, diameter: number): number {
  const room = Math.max(diameter / 2 - CIRCLE_MARGIN, 0);
  const halfDiagonal = Math.hypot(width / 2, height / 2);
  return halfDiagonal <= room ? 1 : room / halfDiagonal;
}

/**
 * Keeps an overlay inside a round eye window of `diameter` (or does nothing
 * when it's `null`). It caps the width so text wraps, then measures what it
 * got; if that still reaches past the circle (a small window, the largest
 * text sizes), it shrinks it until it fits. Put `onLayout` and `style` on
 * the overlay's wrapper; one fit can serve several identical copies.
 */
export function useCircleFit(diameter: number | null): {
  onLayout?: (event: LayoutChangeEvent) => void;
  style?: ViewStyle;
} {
  const [size, setSize] = useState<Size | null>(null);
  if (diameter === null) return {};

  const scale = size ? circleFitScale(size, diameter) : 1;
  return {
    onLayout: ({ nativeEvent: { layout } }) =>
      setSize((current) =>
        current?.width === layout.width && current.height === layout.height
          ? current
          : { width: layout.width, height: layout.height },
      ),
    style: { maxWidth: circleContentWidth(diameter), transform: [{ scale }] },
  };
}
