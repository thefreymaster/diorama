import { StyleSheet, View } from 'react-native';

import { useScaledSize } from '@/theme';
import { SymbolIcon } from '@/ui';

/** Point size of the pin at the default text size. */
const PIN_SIZE = 40;
/**
 * SF Symbols pad a glyph inside its box: the pin's tip sits this share of
 * the box's height above the box's bottom (measured in the Simulator).
 */
const TIP_INSET = 0.08;

/**
 * The fixed pin in the middle of the map, as in Apple Maps' "Move pin to
 * location": the map moves under it. Its tip is the exact middle of the
 * map (an empty box under it balances the pin, less the glyph's padding),
 * which is the spot the map reports. Touches pass through to the map.
 */
export function CenterPin() {
  const size = useScaledSize(PIN_SIZE);

  return (
    <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
      <SymbolIcon name="mappin" size={PIN_SIZE} color="systemRed" weight="semibold" />
      <View style={{ height: size * (1 - 2 * TIP_INSET) }} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});
