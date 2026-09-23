import type { SFSymbol } from 'expo-symbols';
import { Pressable, View } from 'react-native';

import { useIsAccessibilitySize, type ColorToken } from '@/theme';

import { RowIcon } from './RowIcon';
import { RowSeparator } from './RowSeparator';
import { rowStyles } from './rowStyles';
import { SymbolIcon } from './SymbolIcon';
import { Text } from './Text';

/** A run of characters in a row's title (JS string indices). */
export type TitleRange = {
  start: number;
  length: number;
};

export type ListRowProps = {
  title: string;
  /** Parts of the title to draw in the bolder weight, e.g. the letters a search matched. */
  titleHighlights?: readonly TitleRange[];
  /** Second line in secondary text (e.g. a city's country). */
  subtitle?: string;
  /** Trailing value in secondary text (e.g. "1.0×"). Under the title at accessibility text sizes. */
  value?: string;
  /** Leading SF Symbol. */
  symbol?: SFSymbol;
  /** Put the symbol on a colored tile (Settings style) instead of tinting it. */
  symbolTile?: ColorToken;
  /** Trailing chevron. Defaults to shown when the row is tappable. */
  chevron?: boolean;
  /** Red title, for an action that erases or resets (SwiftUI's destructive role). */
  destructive?: boolean;
  onPress?: () => void;
  accessibilityHint?: string;
};

/** One row of an inset-grouped list. Place inside `InsetGroupedSection`. */
export function ListRow({
  title,
  titleHighlights,
  subtitle,
  value,
  symbol,
  symbolTile,
  chevron,
  destructive = false,
  onPress,
  accessibilityHint,
}: ListRowProps) {
  const showChevron = chevron ?? onPress !== undefined;
  const rowStyle = [rowStyles.row, symbol ? null : rowStyles.textOnly];
  // Side by side, a big value would squeeze the title to a letter per line.
  const valueBelow = useIsAccessibilitySize();

  const content = (
    <>
      {symbol ? <RowIcon name={symbol} tileColor={symbolTile} /> : null}
      <View style={rowStyles.content}>
        <RowSeparator />
        <View style={rowStyles.text}>
          <Text color={destructive ? 'systemRed' : 'label'}>
            {titleHighlights?.length
              ? titleRuns(title, titleHighlights).map((run, index) =>
                  run.highlighted ? (
                    <Text key={index} emphasized>
                      {run.text}
                    </Text>
                  ) : (
                    run.text
                  ),
                )
              : title}
          </Text>
          {subtitle ? (
            <Text variant="subheadline" color="secondaryLabel">
              {subtitle}
            </Text>
          ) : null}
          {value && valueBelow ? <Text color="secondaryLabel">{value}</Text> : null}
        </View>
        {value && !valueBelow ? <Text color="secondaryLabel">{value}</Text> : null}
        {showChevron ? (
          <SymbolIcon name="chevron.right" size={14} weight="semibold" color="tertiaryLabel" />
        ) : null}
      </View>
    </>
  );

  if (!onPress) {
    return (
      <View style={rowStyle} accessible>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [rowStyle, pressed && rowStyles.pressed]}
    >
      {content}
    </Pressable>
  );
}

/**
 * Splits `title` into plain and highlighted runs, in order. Ranges may be
 * unsorted or overlap; any part outside the title is ignored.
 */
function titleRuns(title: string, ranges: readonly TitleRange[]) {
  const highlighted = Array.from({ length: title.length }, () => false);
  for (const { start, length } of ranges) {
    for (let i = Math.max(0, start); i < Math.min(title.length, start + length); i += 1) {
      highlighted[i] = true;
    }
  }

  const runs: { text: string; highlighted: boolean }[] = [];
  for (let i = 0; i < title.length; i += 1) {
    const last = runs.at(-1);
    if (last && last.highlighted === highlighted[i]) last.text += title[i];
    else runs.push({ text: title[i], highlighted: highlighted[i] });
  }
  return runs;
}
