import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { metrics, spacing } from '@/theme';

/** Gap between the card and the screen's left, right and bottom edges. */
const CARD_INSET = spacing.sm;
/**
 * Corner radius that sits roughly concentric with the rounded display
 * corners of Face ID iPhones (display radius minus the inset), the way
 * iOS 26 floats its sheets.
 */
const CONCENTRIC_RADIUS = 44;

/**
 * Where the bottom card floats. On iPhones with a home indicator it hugs the
 * rounded screen corners and keeps its content above the indicator; on
 * square-cornered iPhones it uses the list corner radius instead.
 */
export function useCardFrame() {
  const { bottom } = useSafeAreaInsets();
  const hasHomeIndicator = bottom > 0;

  return {
    left: CARD_INSET,
    right: CARD_INSET,
    bottom: CARD_INSET,
    borderRadius: hasHomeIndicator ? CONCENTRIC_RADIUS : metrics.sectionRadius,
    paddingBottom: Math.max(spacing.xxl, bottom - CARD_INSET),
  };
}
