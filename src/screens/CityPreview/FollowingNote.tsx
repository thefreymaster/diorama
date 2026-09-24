import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';
import { SymbolIcon, Text } from '@/ui';

export const FOLLOWING_NOTE = 'Following your location';

/**
 * Under the place's name in live mode: the city moves with you. The arrow
 * is Apple Maps' own location glyph, in its blue, beside quiet text.
 */
export function FollowingNote() {
  return (
    <View testID="following-note" style={styles.row} accessible accessibilityLabel={FOLLOWING_NOTE}>
      <SymbolIcon name="location.fill" size={12} color="systemBlue" weight="semibold" />
      <Text variant="footnote" color="secondaryLabel">
        {FOLLOWING_NOTE}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingTop: spacing.sm,
  },
});
