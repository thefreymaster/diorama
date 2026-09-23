import { StyleSheet } from 'react-native';

import { COUNTDOWN_TITLE } from '@/features/viewer/hud';
import { MAX_GLYPH_SCALE, spacing } from '@/theme';
import { GlassSurface, Text } from '@/ui';

/** Rounder than a list card: a floating system HUD, not content. */
const HUD_RADIUS = spacing.xxl;

type CountdownHudProps = {
  secondsLeft: number;
};

/**
 * "3 / Put on your viewer" on a glass tile. Text grows with Dynamic Type,
 * but only as far as still fits in one eye's half of the screen.
 */
export function CountdownHud({ secondsLeft }: CountdownHudProps) {
  return (
    <GlassSurface style={styles.tile}>
      <Text
        variant="largeTitle"
        emphasized
        maxFontSizeMultiplier={MAX_GLYPH_SCALE}
        style={styles.number}
      >
        {String(secondsLeft)}
      </Text>
      <Text variant="headline" maxFontSizeMultiplier={MAX_GLYPH_SCALE} style={styles.center}>
        {COUNTDOWN_TITLE}
      </Text>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  tile: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.lg,
    borderRadius: HUD_RADIUS,
  },
  // Digits of equal width, so the tile doesn't twitch from 3 to 2 to 1.
  number: { fontVariant: ['tabular-nums'] },
  center: { textAlign: 'center' },
});
