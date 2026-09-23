import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { metrics, useScaledSize } from '@/theme';

/**
 * The leading column of a list row that has an icon. The icon sits centered
 * in it, and the title starts right after it, so every row's text lines up.
 */
export function RowLeadingSlot({ children }: { children: ReactNode }) {
  const width = useScaledSize(metrics.rowIconSlotWidth);
  return <View style={[styles.slot, { width }]}>{children}</View>;
}

const styles = StyleSheet.create({
  slot: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
