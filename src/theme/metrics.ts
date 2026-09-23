import { Platform, StyleSheet } from 'react-native';

/** "26.0.1" → 26. Anything unparseable counts as 0 (treated as older iOS). */
export function iosMajorVersion(version: string | number): number {
  const major = typeof version === 'number' ? Math.floor(version) : parseInt(version, 10);
  return Number.isFinite(major) ? major : 0;
}

/**
 * Inset-grouped list geometry. iOS 26 (Liquid Glass) made lists roomier and
 * rounder; earlier versions keep the classic 44-pt rows and 10-pt corners.
 */
export function listMetrics(iosMajor: number) {
  const modern = iosMajor >= 26;
  return {
    rowMinHeight: modern ? 52 : 44,
    sectionRadius: modern ? 26 : 10,
  };
}

const iosMajor = iosMajorVersion(Platform.Version);

export const metrics = {
  ...listMetrics(iosMajor),
  /** True on iOS 26+, where Liquid Glass replaces the older blur materials. */
  isModernIOS: iosMajor >= 26,
  /** Thinnest line the screen can draw (separators). */
  hairline: StyleSheet.hairlineWidth,
  /** Side margin of inset-grouped cards on iPhone. */
  screenMargin: 16,
  /** Settings-style colored icon tile behind a row symbol. */
  iconTileSize: 29,
  iconTileRadius: 7,
  /** Height of a large prominent button (`.controlSize(.large)`). */
  prominentButtonHeight: 50,
  /** Height of a floating glass button; also the minimum tap target. */
  glassButtonHeight: 44,
} as const;
