import { StyleSheet, View } from 'react-native';

import { COUNTDOWN_TITLE } from '@/features/viewer/hud';
import { MAX_GLYPH_SCALE, spacing } from '@/theme';
import { Text } from '@/ui';

type CountdownHudProps = {
  secondsLeft: number;
};

/**
 * "3 / Put on your viewer", for the HUD's glass tile. Text grows with
 * Dynamic Type, but only as far as still fits in one eye's lens window.
 */
export function CountdownHud({ secondsLeft }: CountdownHudProps) {
  return (
    <View style={styles.stack}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { alignItems: 'center', gap: spacing.xs },
  // Digits of equal width, so the tile doesn't twitch from 3 to 2 to 1.
  number: { fontVariant: ['tabular-nums'] },
  center: { textAlign: 'center' },
});
