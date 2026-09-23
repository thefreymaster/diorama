import type { SFSymbol } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

import { colors, metrics, useScaledSize, type ColorToken } from '@/theme';

import { RowLeadingSlot } from './RowLeadingSlot';
import { SymbolIcon } from './SymbolIcon';

type RowIconProps = {
  name: SFSymbol;
  /** With a color: white glyph on a Settings-style tile. Without: a larger plain tinted glyph. */
  tileColor?: ColorToken;
};

/** The leading icon of a list row, centered in the row's icon column. */
export function RowIcon({ name, tileColor }: RowIconProps) {
  const tile = useScaledSize(metrics.iconTileSize);
  const radius = (tile * metrics.iconTileRadius) / metrics.iconTileSize;

  return (
    <RowLeadingSlot>
      {tileColor ? (
        <View
          style={[
            styles.tile,
            { width: tile, height: tile, borderRadius: radius },
            { backgroundColor: colors[tileColor] },
          ]}
        >
          <SymbolIcon name={name} size={metrics.tileSymbolSize} weight="medium" color="onTint" />
        </View>
      ) : (
        <SymbolIcon name={name} size={metrics.plainRowSymbolSize} color="tint" />
      )}
    </RowLeadingSlot>
  );
}

const styles = StyleSheet.create({
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    borderCurve: 'continuous',
  },
});
