import { StyleSheet } from 'react-native';

import { HUD_NOTICES, type HudNotice } from '@/features/viewer/hud';
import { MAX_GLYPH_SCALE, metrics, spacing, useScaledSize } from '@/theme';
import { GlassSurface, SymbolIcon, Text } from '@/ui';

type NoticeHudProps = {
  notice: HudNotice;
};

/** A glass capsule with a symbol and a few words, like the system's own HUDs. */
export function NoticeHud({ notice }: NoticeHudProps) {
  const { text, symbol } = HUD_NOTICES[notice];
  const height = useScaledSize(metrics.glassButtonHeight);

  return (
    <GlassSurface style={[styles.capsule, { minHeight: height, borderRadius: height / 2 }]}>
      <SymbolIcon name={symbol} weight="semibold" />
      <Text variant="headline" maxFontSizeMultiplier={MAX_GLYPH_SCALE} style={styles.text}>
        {text}
      </Text>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  capsule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  text: { flexShrink: 1, textAlign: 'center' },
});
