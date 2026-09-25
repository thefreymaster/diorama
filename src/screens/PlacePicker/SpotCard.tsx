import { StyleSheet, View } from 'react-native';

import { flyoverCoverageAt, type PlacePickerRegion } from '@diorama/native';
import { useCardFrame } from '@/screens/CityPreview/useCardFrame';
import { spacing } from '@/theme';
import { GlassSurface, PrimaryButton, Text } from '@/ui';

import { CoverageNote } from './CoverageNote';
import { useOpenSpot } from './useOpenSpot';
import { useSpotPlace } from './useSpotPlace';

type SpotCardProps = {
  /** The spot under the pin. */
  spot: PlacePickerRegion;
  /** Points the card covers at the bottom of the screen, gap included. */
  onCoverHeight: (height: number) => void;
};

/**
 * The glass card floating over the bottom of the map, like the preview's:
 * the name of the spot under the pin, its town and country, whether it has
 * 3D buildings, and "Open diorama".
 */
export function SpotCard({ spot, onCoverHeight }: SpotCardProps) {
  const { left, right, bottom, borderRadius, paddingBottom } = useCardFrame();
  const place = useSpotPlace(spot);
  const { open, isOpening } = useOpenSpot();

  return (
    <View
      style={[styles.position, { left, right, bottom }]}
      onLayout={(event) => onCoverHeight(event.nativeEvent.layout.height + bottom)}
    >
      <GlassSurface style={[styles.card, { borderRadius, paddingBottom }]}>
        <View>
          {/* Capped, so at the largest text sizes the card stays clear of the pin. */}
          <Text variant="title2" emphasized accessibilityRole="header" numberOfLines={2}>
            {place.name}
          </Text>
          {place.country ? (
            <Text variant="body" color="secondaryLabel" numberOfLines={1}>
              {place.country}
            </Text>
          ) : null}
          <CoverageNote coverage={flyoverCoverageAt(spot)} />
        </View>
        <PrimaryButton
          title="Open diorama"
          onPress={() => open(spot)}
          loading={isOpening}
          accessibilityHint="Opens a preview of the spot under the pin."
        />
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  position: { position: 'absolute' },
  card: {
    gap: spacing.xl,
    paddingTop: spacing.xxl,
    paddingHorizontal: spacing.xxl,
  },
});
