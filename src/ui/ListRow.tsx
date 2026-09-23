import type { SFSymbol } from 'expo-symbols';
import { Pressable, View } from 'react-native';

import type { ColorToken } from '@/theme';

import { RowIcon } from './RowIcon';
import { RowSeparator } from './RowSeparator';
import { rowStyles } from './rowStyles';
import { SymbolIcon } from './SymbolIcon';
import { Text } from './Text';

export type ListRowProps = {
  title: string;
  /** Second line in secondary text (e.g. a city's country). */
  subtitle?: string;
  /** Trailing value in secondary text (e.g. "1.0×"). */
  value?: string;
  /** Leading SF Symbol. */
  symbol?: SFSymbol;
  /** Put the symbol on a colored tile (Settings style) instead of tinting it. */
  symbolTile?: ColorToken;
  /** Trailing chevron. Defaults to shown when the row is tappable. */
  chevron?: boolean;
  onPress?: () => void;
  accessibilityHint?: string;
};

/** One row of an inset-grouped list. Place inside `InsetGroupedSection`. */
export function ListRow({
  title,
  subtitle,
  value,
  symbol,
  symbolTile,
  chevron,
  onPress,
  accessibilityHint,
}: ListRowProps) {
  const showChevron = chevron ?? onPress !== undefined;

  const content = (
    <>
      {symbol ? <RowIcon name={symbol} tileColor={symbolTile} /> : null}
      <View style={rowStyles.content}>
        <RowSeparator />
        <View style={rowStyles.text}>
          <Text>{title}</Text>
          {subtitle ? (
            <Text variant="subheadline" color="secondaryLabel">
              {subtitle}
            </Text>
          ) : null}
        </View>
        {value ? <Text color="secondaryLabel">{value}</Text> : null}
        {showChevron ? (
          <SymbolIcon name="chevron.right" size={14} weight="semibold" color="tertiaryLabel" />
        ) : null}
      </View>
    </>
  );

  if (!onPress) {
    return (
      <View style={rowStyles.row} accessible>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [rowStyles.row, pressed && rowStyles.pressed]}
    >
      {content}
    </Pressable>
  );
}
