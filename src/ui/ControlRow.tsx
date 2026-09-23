import type { ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';

import { RowSeparator } from './RowSeparator';
import { rowStyles } from './rowStyles';

type RowAccessibilityProps = Pick<
  ViewProps,
  | 'accessible'
  | 'accessibilityRole'
  | 'accessibilityLabel'
  | 'accessibilityHint'
  | 'accessibilityState'
  | 'onAccessibilityTap'
>;

export type ControlRowProps = RowAccessibilityProps & {
  /** Laid out in a row: a title and a switch, or a slider between two glyphs. */
  children: ReactNode;
  /** Taller than a text row, e.g. 56 pt for a slider like Brightness. */
  minHeight?: number;
};

/**
 * A list row built around a control (a switch, a slider) instead of a
 * title: the standard insets, height and separator, with anything inside.
 * Place inside `InsetGroupedSection`. The accessibility props let the whole
 * row act as one control for VoiceOver.
 */
export function ControlRow({ children, minHeight, ...accessibility }: ControlRowProps) {
  return (
    <View style={[rowStyles.row, rowStyles.textOnly]} {...accessibility}>
      <View style={[rowStyles.content, minHeight === undefined ? null : { minHeight }]}>
        <RowSeparator />
        {children}
      </View>
    </View>
  );
}
