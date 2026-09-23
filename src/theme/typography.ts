import type { TextStyle } from 'react-native';

/**
 * Apple's iOS text styles, largest to smallest. The names double as RN's
 * `dynamicTypeRamp` values, so each style scales with Dynamic Type on its own
 * curve, exactly like UIKit's `UIFont.preferredFont(forTextStyle:)`.
 */
export const textVariants = [
  'largeTitle',
  'title1',
  'title2',
  'title3',
  'headline',
  'body',
  'callout',
  'subheadline',
  'footnote',
  'caption1',
  'caption2',
] as const;

export type TextVariant = (typeof textVariants)[number];

type FontWeight = '400' | '600' | '700';

type RampEntry = {
  fontSize: number;
  lineHeight: number;
  fontWeight: FontWeight;
  /** Weight of the "emphasized" variant (SwiftUI `.bold()` on the style). */
  emphasizedWeight: FontWeight;
};

/**
 * Sizes at the default ("Large") Dynamic Type setting, from the HIG
 * Typography tables. No letterSpacing: SF Pro tracks itself per size.
 */
export const typeRamp: Record<TextVariant, RampEntry> = {
  largeTitle: { fontSize: 34, lineHeight: 41, fontWeight: '400', emphasizedWeight: '700' },
  title1: { fontSize: 28, lineHeight: 34, fontWeight: '400', emphasizedWeight: '700' },
  title2: { fontSize: 22, lineHeight: 28, fontWeight: '400', emphasizedWeight: '700' },
  title3: { fontSize: 20, lineHeight: 25, fontWeight: '400', emphasizedWeight: '600' },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600', emphasizedWeight: '600' },
  body: { fontSize: 17, lineHeight: 22, fontWeight: '400', emphasizedWeight: '600' },
  callout: { fontSize: 16, lineHeight: 21, fontWeight: '400', emphasizedWeight: '600' },
  subheadline: { fontSize: 15, lineHeight: 20, fontWeight: '400', emphasizedWeight: '600' },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: '400', emphasizedWeight: '600' },
  caption1: { fontSize: 12, lineHeight: 16, fontWeight: '400', emphasizedWeight: '600' },
  caption2: { fontSize: 11, lineHeight: 13, fontWeight: '400', emphasizedWeight: '600' },
};

/** The style object for one text style, optionally emphasized. */
export function textStyle(variant: TextVariant, emphasized = false): TextStyle {
  const { fontSize, lineHeight, fontWeight, emphasizedWeight } = typeRamp[variant];
  return { fontSize, lineHeight, fontWeight: emphasized ? emphasizedWeight : fontWeight };
}
