import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { metrics, spacing } from '@/theme';

import { Text } from '../Text';

type DemoBlockProps = {
  title: string;
  children: ReactNode;
};

/** Gallery-only: a titled block without a card, for controls that sit on the ground. */
export function DemoBlock({ title, children }: DemoBlockProps) {
  return (
    <View style={styles.block}>
      <Text variant="footnote" color="secondaryLabel" style={styles.header}>
        {title}
      </Text>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    marginTop: spacing.xxl,
    marginHorizontal: metrics.screenMargin,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    textTransform: 'uppercase',
  },
  body: {
    gap: spacing.md,
  },
});
