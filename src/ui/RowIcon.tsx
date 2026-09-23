import type { SFSymbol } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

import { colors, metrics, useScaledSize, type ColorToken } from '@/theme';

import { SymbolIcon } from './SymbolIcon';

type RowIconProps = {
  name: SFSymbol;
  /** With a color: white glyph on a Settings-style tile. Without: a plain tinted glyph. */
  tileColor?: ColorToken;
};

/** The leading icon of a list row. Always tile-sized, so titles line up. */
export function RowIcon({ name, tileColor }: RowIconProps) {
  const tile = useScaledSize(metrics.iconTileSize);
  const radius = (tile * metrics.iconTileRadius) / metrics.iconTileSize;
  const box = { width: tile, height: tile, borderRadius: radius };

  if (!tileColor) {
    return (
      <View style={[styles.box, box]}>
        <SymbolIcon name={name} size={20} color="tint" />
      </View>
    );
  }

  return (
    <View style={[styles.box, box, { backgroundColor: colors[tileColor] }]}>
      <SymbolIcon name={name} size={16} weight="medium" color="onTint" />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    justifyContent: 'center',
    borderCurve: 'continuous',
  },
});
