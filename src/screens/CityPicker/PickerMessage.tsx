import type { SFSymbol } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

import { metrics, spacing } from '@/theme';
import { SymbolIcon, Text } from '@/ui';

type PickerMessageProps = {
  symbol: SFSymbol;
  title: string;
  body: string;
};

/**
 * A quiet, centered note in place of results, like SwiftUI's
 * `ContentUnavailableView`: a gray glyph, a short title and one line of help.
 */
export function PickerMessage({ symbol, title, body }: PickerMessageProps) {
  return (
    <View style={styles.container} accessible accessibilityLabel={`${title}. ${body}`}>
      <SymbolIcon name={symbol} size={44} color="secondaryLabel" style={styles.symbol} />
      <Text variant="title3" emphasized style={styles.center}>
        {title}
      </Text>
      <Text variant="subheadline" color="secondaryLabel" style={styles.center}>
        {body}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.huge,
    marginHorizontal: metrics.screenMargin + spacing.lg,
  },
  symbol: {
    marginBottom: spacing.sm,
  },
  center: {
    textAlign: 'center',
  },
});
