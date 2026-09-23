import { SymbolView, type SFSymbol, type SymbolType, type SymbolWeight } from 'expo-symbols';
import type { StyleProp, ViewStyle } from 'react-native';

import { colors, useScaledSize, type ColorToken } from '@/theme';

export type SymbolIconProps = {
  name: SFSymbol;
  /** Point size at the default text size. Grows with Dynamic Type. Default 17 (body). */
  size?: number;
  /** Color token. Default `label`. */
  color?: ColorToken;
  /** Match the weight of the text next to it. Default `regular`. */
  weight?: SymbolWeight;
  type?: SymbolType;
  /** Give a label only when the symbol means something on its own; otherwise VoiceOver skips it. */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * An SF Symbol, sized and colored with theme tokens (the task calls it `Symbol`).
 * Never name a component `Symbol`: the React Compiler emits
 * `Symbol.for(...)`, and an imported `Symbol` would shadow the global and crash.
 */
export function SymbolIcon({
  name,
  size = 17,
  color = 'label',
  weight = 'regular',
  type = 'monochrome',
  accessibilityLabel,
  style,
}: SymbolIconProps) {
  const scaledSize = useScaledSize(size);
  const decorative = accessibilityLabel === undefined;

  return (
    <SymbolView
      name={name}
      size={scaledSize}
      tintColor={colors[color]}
      weight={weight}
      type={type}
      style={style}
      accessible={!decorative}
      accessibilityElementsHidden={decorative}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={decorative ? undefined : 'image'}
    />
  );
}
