import { StyleSheet, View } from 'react-native';

import { COUNTDOWN_HINT, COUNTDOWN_TITLE } from '@/features/viewer/hud';
import { MAX_GLYPH_SCALE, spacing } from '@/theme';
import { Text } from '@/ui';

type CountdownHudProps = {
  secondsLeft: number;
};

/**
 * "3 / Put on your viewer / Hold anywhere to exit", for the HUD's glass
 * tile. Compact, like a system HUD, so it fits inside a round eye window at
 * full size. Text grows with Dynamic Type up to a cap; past what the circle
 * holds, the eye's fit (`useCircleFit`) wraps it and then shrinks it.
 */
export function CountdownHud({ secondsLeft }: CountdownHudProps) {
  return (
    <View style={styles.stack}>
      <Text
        variant="title1"
        emphasized
        maxFontSizeMultiplier={MAX_GLYPH_SCALE}
        style={styles.number}
      >
        {String(secondsLeft)}
      </Text>
      <Text
        variant="subheadline"
        emphasized
        maxFontSizeMultiplier={MAX_GLYPH_SCALE}
        style={styles.center}
      >
        {COUNTDOWN_TITLE}
      </Text>
      <Text
        variant="footnote"
        color="secondaryLabel"
        maxFontSizeMultiplier={MAX_GLYPH_SCALE}
        style={styles.center}
      >
        {COUNTDOWN_HINT}
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
