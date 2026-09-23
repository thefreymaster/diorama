import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { colors, textStyle, type ColorToken, type TextVariant } from '@/theme';

export type TextProps = RNTextProps & {
  /** iOS text style. Default `body`. */
  variant?: TextVariant;
  /** Color token. Default `label`. */
  color?: ColorToken;
  /** Use the style's emphasized (bolder) weight. */
  emphasized?: boolean;
};

/**
 * SF Pro text on the iOS type ramp. `dynamicTypeRamp` makes each style scale
 * with the user's text size on its own curve, the way UIKit text does.
 */
export function Text({
  variant = 'body',
  color = 'label',
  emphasized = false,
  style,
  ...rest
}: TextProps) {
  return (
    <RNText
      dynamicTypeRamp={variant}
      style={[textStyle(variant, emphasized), { color: colors[color] }, style]}
      {...rest}
    />
  );
}
