import { StyleSheet, View } from 'react-native';

import { spacing, textVariants, typeRamp, type TextVariant } from '@/theme';

import { Text } from '../Text';

const labels: Record<TextVariant, string> = {
  largeTitle: 'Large title',
  title1: 'Title 1',
  title2: 'Title 2',
  title3: 'Title 3',
  headline: 'Headline',
  body: 'Body',
  callout: 'Callout',
  subheadline: 'Subheadline',
  footnote: 'Footnote',
  caption1: 'Caption 1',
  caption2: 'Caption 2',
};

/** Gallery-only: every text style, with its size at the default text setting. */
export function TypeRampCard() {
  return (
    <View style={styles.card}>
      {textVariants.map((variant) => (
        <View key={variant} style={styles.line}>
          <Text variant={variant} style={styles.sample} numberOfLines={1}>
            {labels[variant]}
          </Text>
          <Text variant="caption1" color="secondaryLabel">
            {typeRamp[variant].fontSize} pt
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  sample: { flex: 1 },
});
