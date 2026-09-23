import type { SymbolWeight } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';

import { SymbolIcon } from '../SymbolIcon';
import { Text } from '../Text';

const weights: SymbolWeight[] = ['ultraLight', 'light', 'regular', 'semibold', 'bold', 'black'];

/** Gallery-only: symbol weights, tints and rendering modes. */
export function SymbolsCard() {
  return (
    <View style={styles.card}>
      <View style={styles.line}>
        {weights.map((weight) => (
          <SymbolIcon key={weight} name="building.2" size={24} weight={weight} />
        ))}
      </View>
      <View style={styles.line}>
        <SymbolIcon name="scope" size={24} color="tint" />
        <SymbolIcon name="gyroscope" size={24} color="systemOrange" />
        <SymbolIcon name="eyeglasses" size={24} color="systemPurple" />
        <SymbolIcon name="cloud.sun.rain.fill" size={24} type="multicolor" />
        <SymbolIcon name="globe.americas.fill" size={24} type="hierarchical" color="systemGreen" />
      </View>
      <Text variant="footnote" color="secondaryLabel">
        Symbols grow with Dynamic Type, like the text next to them.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  line: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
