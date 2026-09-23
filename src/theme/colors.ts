import { PlatformColor, type ColorValue } from 'react-native';

/**
 * iOS system colors. `PlatformColor` hands UIKit the color *name*, so every
 * token follows light/dark mode and Increase Contrast on its own.
 * Names match Apple's (UIColor.label → `label`) so the HIG docs apply 1:1.
 */
export const colors = {
  // Text
  label: PlatformColor('label'),
  secondaryLabel: PlatformColor('secondaryLabel'),
  tertiaryLabel: PlatformColor('tertiaryLabel'),
  quaternaryLabel: PlatformColor('quaternaryLabel'),
  placeholderText: PlatformColor('placeholderText'),

  // Backgrounds: plain screens use `systemBackground`, inset-grouped lists
  // sit on `systemGroupedBackground` with cards in the "secondary" shade.
  systemBackground: PlatformColor('systemBackground'),
  secondarySystemBackground: PlatformColor('secondarySystemBackground'),
  systemGroupedBackground: PlatformColor('systemGroupedBackground'),
  secondarySystemGroupedBackground: PlatformColor('secondarySystemGroupedBackground'),
  tertiarySystemGroupedBackground: PlatformColor('tertiarySystemGroupedBackground'),

  // Fills for shapes on top of backgrounds (skeletons, disabled controls)
  systemFill: PlatformColor('systemFill'),
  secondarySystemFill: PlatformColor('secondarySystemFill'),
  tertiarySystemFill: PlatformColor('tertiarySystemFill'),
  quaternarySystemFill: PlatformColor('quaternarySystemFill'),

  separator: PlatformColor('separator'),
  opaqueSeparator: PlatformColor('opaqueSeparator'),

  // Standard tints (row icon tiles, accents)
  systemBlue: PlatformColor('systemBlue'),
  systemBrown: PlatformColor('systemBrown'),
  systemCyan: PlatformColor('systemCyan'),
  systemGreen: PlatformColor('systemGreen'),
  systemIndigo: PlatformColor('systemIndigo'),
  systemMint: PlatformColor('systemMint'),
  systemOrange: PlatformColor('systemOrange'),
  systemPink: PlatformColor('systemPink'),
  systemPurple: PlatformColor('systemPurple'),
  systemRed: PlatformColor('systemRed'),
  systemTeal: PlatformColor('systemTeal'),
  systemYellow: PlatformColor('systemYellow'),
  systemGray: PlatformColor('systemGray'),
  systemGray4: PlatformColor('systemGray4'),

  // Semantic aliases used by the primitives
  /** The app accent: buttons, links, plain row symbols. */
  tint: PlatformColor('systemBlue'),
  /** Text and glyphs on a filled tint (UIKit uses white in light and dark). */
  onTint: '#FFFFFF',
  /** Background of a list row while it's pressed (UITableViewCell's highlight). */
  rowHighlight: PlatformColor('systemGray4'),
} as const satisfies Record<string, ColorValue>;

/** Any color the UI may use. Components take a token name, never a raw color. */
export type ColorToken = keyof typeof colors;
