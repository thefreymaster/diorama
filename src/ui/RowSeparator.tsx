import { StyleSheet, View } from 'react-native';

import { colors, metrics } from '@/theme';

import { useRowPosition } from './rowPosition';

/**
 * Hairline above a row, drawn inside the row's content column so it starts
 * where the text starts (after the icon), like UIKit's separator inset.
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
    right: 0,
    height: metrics.hairline,
    backgroundColor: colors.separator,
  },
});
