import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';

import type { HudContent } from '@/features/viewer/hud';
import { metrics, spacing, useScaledSize } from '@/theme';
import { GlassSurface } from '@/ui';

/** Rounder than a list card: a floating system HUD, not content. */
const TILE_RADIUS = spacing.xxl;

type HudGlassProps = {
  /** The countdown sits on a tile; a notice on a capsule. */
  kind: HudContent['kind'];
  /** Materializes or dissolves the glass. */
  visible: boolean;
  children: ReactNode;
};

/**
 * The HUD's glass. It stays mounted for the whole visit (it's empty and
 * dissolved until there's something to say), so every time the HUD shows,
 * the glass materializes rather than popping in.
 */
export function HudGlass({ kind, visible, children }: HudGlassProps) {
  const capsuleHeight = useScaledSize(metrics.glassButtonHeight);
  const shape =
    kind === 'countdown'
      ? styles.tile
      : [styles.capsule, { minHeight: capsuleHeight, borderRadius: capsuleHeight / 2 }];

  return (
    <GlassSurface visible={visible} style={shape}>
      {children}
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  tile: {
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.lg,
    borderRadius: TILE_RADIUS,
  },
  capsule: {
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
});
