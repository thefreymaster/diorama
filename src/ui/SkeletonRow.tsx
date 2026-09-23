import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { colors, metrics, spacing, useScaledSize } from '@/theme';

import { RowLeadingSlot } from './RowLeadingSlot';
import { RowSeparator } from './RowSeparator';
import { rowStyles } from './rowStyles';
import { usePulse } from './usePulse';

export type SkeletonRowProps = {
  /** Reserve a leading icon tile, to match rows that have a symbol. Default true. */
  icon?: boolean;
  /** Show a second, shorter bar for a subtitle. Default true. */
  subtitle?: boolean;
};

/** Placeholder for a `ListRow` while its data loads. Same size and insets. */
export function SkeletonRow({ icon = true, subtitle = true }: SkeletonRowProps) {
  const pulse = usePulse();
  const tile = useScaledSize(metrics.iconTileSize);
  const titleHeight = useScaledSize(14);
  const subtitleHeight = useScaledSize(11);

  return (
    <View
      style={[rowStyles.row, icon ? null : rowStyles.textOnly]}
      accessible
      accessibilityLabel="Loading"
    >
      {icon ? (
        <RowLeadingSlot>
          <Animated.View style={[styles.tile, { width: tile, height: tile }, pulse]} />
        </RowLeadingSlot>
      ) : null}
      <View style={rowStyles.content}>
        <RowSeparator />
        <View style={[rowStyles.text, styles.bars]}>
          <Animated.View style={[styles.bar, styles.title, { height: titleHeight }, pulse]} />
          {subtitle ? (
            <Animated.View
              style={[styles.bar, styles.subtitle, { height: subtitleHeight }, pulse]}
            />
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: metrics.iconTileRadius,
    borderCurve: 'continuous',
    backgroundColor: colors.systemFill,
  },
  bars: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  bar: {
    borderRadius: spacing.xs,
    backgroundColor: colors.systemFill,
  },
  title: { width: '55%' },
  subtitle: { width: '35%', backgroundColor: colors.tertiarySystemFill },
});
