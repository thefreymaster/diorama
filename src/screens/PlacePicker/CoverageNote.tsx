import { StyleSheet, View } from 'react-native';

import type { FlyoverCoverage } from '@diorama/native';
import { TERRAIN_NOTE } from '@/screens/CityPreview/TerrainNote';
import { spacing } from '@/theme';
import { SymbolIcon, Text } from '@/ui';

export const BUILDINGS_NOTE = '3D buildings';

type CoverageNoteProps = {
  coverage: FlyoverCoverage;
};

/**
 * What the diorama will look like here, from the hand-checked lists: "3D
 * buildings" where Apple has them, the preview's terrain note where the
 * place was checked and found flat, and nothing where nobody has looked.
 */
export function CoverageNote({ coverage }: CoverageNoteProps) {
  if (coverage === 'unknown') return null;

  if (coverage === 'no') {
    return (
      <Text testID="coverage-note" variant="footnote" color="secondaryLabel" style={styles.note}>
        {TERRAIN_NOTE}
      </Text>
    );
  }

  return (
    <View testID="coverage-note" style={[styles.note, styles.row]} accessible>
      <SymbolIcon name="building.2.fill" size={12} color="secondaryLabel" weight="semibold" />
      <Text variant="footnote" color="secondaryLabel">
        {BUILDINGS_NOTE}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  note: { paddingTop: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
