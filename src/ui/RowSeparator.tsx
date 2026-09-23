import { StyleSheet, View } from 'react-native';

import { colors, metrics } from '@/theme';

import { useRowPosition } from './rowPosition';

/**
 * Line above a row, drawn inside the row's content column so it starts where
 * the text starts (after the icon), like UIKit's separator inset. On iOS 26 it
 * is 1 pt thick and stops 16 pt before the card's right edge.
 */
export function RowSeparator() {
  const { isFirst } = useRowPosition();
  if (isFirst) return null;
  return <View style={styles.line} />;
}

const styles = StyleSheet.create({
  line: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: metrics.separatorTrailingInset,
    height: metrics.separatorThickness,
    backgroundColor: colors.separator,
  },
});
