import { Children, isValidElement, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, metrics, spacing } from '@/theme';

import { RowPositionContext } from './rowPosition';
import { Text } from './Text';

export type InsetGroupedSectionProps = {
  /** Short header above the card. Write it in sentence case; it displays uppercased. */
  title?: string;
  /** Explanatory footnote below the card. */
  footer?: string;
  /** Rows (`ListRow`, `SkeletonRow`) or any custom content. */
  children: ReactNode;
};

/** A rounded card of rows on the grouped background, like Settings. */
export function InsetGroupedSection({ title, footer, children }: InsetGroupedSectionProps) {
  const rows = Children.toArray(children);

  return (
    <View style={styles.section}>
      {title ? (
        <Text
          variant="footnote"
          color="secondaryLabel"
          style={styles.header}
          accessibilityRole="header"
        >
          {title}
        </Text>
      ) : null}
      <View style={styles.card}>
        {rows.map((row, index) => (
          <RowPositionContext
            key={isValidElement(row) ? row.key : index}
            value={{ isFirst: index === 0 }}
          >
            {row}
          </RowPositionContext>
        ))}
      </View>
      {footer ? (
        <Text variant="footnote" color="secondaryLabel" style={styles.footer}>
          {footer}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: spacing.xxl,
    marginHorizontal: metrics.screenMargin,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: colors.secondarySystemGroupedBackground,
    borderRadius: metrics.sectionRadius,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
});
