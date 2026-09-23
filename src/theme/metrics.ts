import { Platform, StyleSheet } from 'react-native';

/** "26.0.1" → 26. Anything unparseable counts as 0 (treated as older iOS). */
export function iosMajorVersion(version: string | number): number {
  const major = typeof version === 'number' ? Math.floor(version) : parseInt(version, 10);
  return Number.isFinite(major) ? major : 0;
}

/**
 * Inset-grouped list geometry. iOS 26 (Liquid Glass) made lists roomier and
 * rounder, with 1-pt separators that stop short of the card's right edge.
 * Earlier versions keep 44-pt rows, 10-pt corners and full-width hairlines.
 * iOS 26 values are measured from the Settings app (iPhone 17 Pro).
 */
export function listMetrics(iosMajor: number, hairline: number) {
  const modern = iosMajor >= 26;
  return {
    rowMinHeight: modern ? 52 : 44,
    sectionRadius: modern ? 26 : 10,
    separatorThickness: modern ? 1 : hairline,
    separatorTrailingInset: modern ? 16 : 0,
  };
}

const iosMajor = iosMajorVersion(Platform.Version);

export const metrics = {
  ...listMetrics(iosMajor, StyleSheet.hairlineWidth),
  /** True on iOS 26+, where Liquid Glass replaces the older blur materials. */
  isModernIOS: iosMajor >= 26,
  /** Thinnest line the screen can draw. */
  hairline: StyleSheet.hairlineWidth,
  /** Side margin of inset-grouped cards on iPhone. */
  screenMargin: 16,
  /**
   * Width of a row's leading icon column. The icon is centered in it and the
   * title (and separator) start right after it, 56 pt in, as in Settings.
   */
  rowIconSlotWidth: 56,
  /** Settings-style colored icon tile behind a row symbol. */
  iconTileSize: 29,
  iconTileRadius: 7,
  /** Point size of the white glyph on a tile. */
  tileSymbolSize: 16,
  /** Point size of a leading symbol without a tile, so it weighs about as much as a tile. */
  plainRowSymbolSize: 28,
  /** Height of a large prominent button (`.controlSize(.large)`). */
  prominentButtonHeight: 50,
  /** Height of a floating glass button; also the minimum tap target. */
  glassButtonHeight: 44,
} as const;
