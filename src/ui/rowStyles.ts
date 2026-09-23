import { StyleSheet } from 'react-native';

import { colors, metrics, spacing } from '@/theme';

/** Layout shared by `ListRow` and `SkeletonRow` so loading rows line up exactly. */
export const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: spacing.lg,
    gap: spacing.lg,
  },
  pressed: {
    backgroundColor: colors.rowHighlight,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: spacing.sm,
    minHeight: metrics.rowMinHeight,
    paddingVertical: spacing.sm,
    paddingRight: spacing.lg,
  },
  text: {
    flex: 1,
  },
});
