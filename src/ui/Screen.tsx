import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/theme';

import { closeOpenSwipeRow, screenTouched } from './openSwipeRow';

export type ScreenProps = {
  children: ReactNode;
  /** `grouped` for inset-grouped lists (gray ground), `plain` for everything else. */
  background?: 'grouped' | 'plain';
  /** Scrolls by default. Turn off for full-bleed screens (map preview, viewer). */
  scroll?: boolean;
};

/**
 * The root of every screen. The scroll view comes first and uses automatic
 * content insets, so the native stack header can drive large titles, the
 * search bar and the safe area for us.
 */
export function Screen({ children, background = 'plain', scroll = true }: ScreenProps) {
  const ground = background === 'grouped' ? styles.grouped : styles.plain;

  if (!scroll) {
    return <View style={[styles.fill, ground]}>{children}</View>;
  }

  return (
    <ScrollView
      style={[styles.fill, ground]}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      // A row swiped open closes as soon as anything else is touched, or the list scrolls.
      onTouchStart={screenTouched}
      onScrollBeginDrag={closeOpenSwipeRow}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  plain: { backgroundColor: colors.systemBackground },
  grouped: { backgroundColor: colors.systemGroupedBackground },
  content: { paddingBottom: spacing.xxxl },
});
