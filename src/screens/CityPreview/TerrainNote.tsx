import { spacing } from '@/theme';
import { Text } from '@/ui';

import { SpringReveal } from './SpringReveal';

export const TERRAIN_NOTE = "3D buildings aren't available here. Terrain only.";

/**
 * The quiet "no Flyover here" line under the country, shown only where the
 * place is known to be flat (not merely unlisted). It opens up with a
 * spring, so the card grows smoothly instead of jumping.
 */
export function TerrainNote() {
  return (
    <SpringReveal paddingTop={spacing.sm} testID="terrain-note" contentTestID="terrain-note-text">
      <Text variant="footnote" color="secondaryLabel">
        {TERRAIN_NOTE}
      </Text>
    </SpringReveal>
  );
}
