import { StyleSheet, View } from 'react-native';

import { HUD_NOTICES, type HudNotice } from '@/features/viewer/hud';
import { MAX_GLYPH_SCALE, spacing } from '@/theme';
import { SymbolIcon, Text } from '@/ui';

type NoticeHudProps = {
  notice: HudNotice;
};

/** A symbol and a few words, for the HUD's glass capsule, like the system's own HUDs. */
export function NoticeHud({ notice }: NoticeHudProps) {
  const { text, symbol } = HUD_NOTICES[notice];

  return (
    <View style={styles.row}>
      <SymbolIcon name={symbol} weight="semibold" />
      <Text variant="headline" maxFontSizeMultiplier={MAX_GLYPH_SCALE} style={styles.text}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  text: { flexShrink: 1, textAlign: 'center' },
});
