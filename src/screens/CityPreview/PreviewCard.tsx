import { StyleSheet, View } from 'react-native';

import type { City } from '@/features/cities/queries';
import { spacing } from '@/theme';
import { GlassSurface, PrimaryButton, Text } from '@/ui';

import { ENTER_DIORAMA_SYMBOL } from './enterDioramaSymbol';
import { TerrainNote } from './TerrainNote';
import { useCardFrame } from './useCardFrame';
import { useEnterDiorama } from './useEnterDiorama';

type PreviewCardProps = {
  city: City;
  /** The map has drawn and found no 3D buildings here. */
  showTerrainNote: boolean;
};

/**
 * The glass card floating over the bottom of the map: where you are, and
 * the one thing to do here.
 */
export function PreviewCard({ city, showTerrainNote }: PreviewCardProps) {
  const frame = useCardFrame();
  const enterDiorama = useEnterDiorama(city.id);

  return (
    <GlassSurface style={[styles.card, frame]}>
      <View>
        <Text variant="title1" emphasized accessibilityRole="header">
          {city.name}
        </Text>
        {city.country ? (
          <Text variant="body" color="secondaryLabel">
            {city.country}
          </Text>
        ) : null}
        {showTerrainNote ? <TerrainNote /> : null}
      </View>
      <View style={styles.action}>
        <PrimaryButton
          title="Enter Diorama"
          symbol={ENTER_DIORAMA_SYMBOL}
          onPress={enterDiorama}
          accessibilityHint="Opens the city full screen, in landscape."
        />
        <Text variant="footnote" color="secondaryLabel" style={styles.guidance}>
          Place your iPhone in your viewer.
        </Text>
      </View>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    gap: spacing.xl,
    paddingTop: spacing.xxl,
    paddingHorizontal: spacing.xxl,
  },
  action: { gap: spacing.md },
  guidance: { textAlign: 'center' },
});
