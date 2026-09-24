import { StyleSheet, View } from 'react-native';

import type { City } from '@/features/cities/queries';
import { useFollowsMe } from '@/features/location/liveMode';
import { useSetting } from '@/features/settings/store';
import { spacing } from '@/theme';
import { GlassSurface, PrimaryButton, Text } from '@/ui';

import { ENTER_DIORAMA_SYMBOL } from './enterDioramaSymbol';
import { FollowingNote } from './FollowingNote';
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
 * the one thing to do here. In live mode it says the city is following
 * you. Under the button, how to get to the headset view (it's the sideways
 * one); with the two-eye view off in Settings there's no headset view, so
 * no word about one.
 */
export function PreviewCard({ city, showTerrainNote }: PreviewCardProps) {
  const frame = useCardFrame();
  const enterDiorama = useEnterDiorama(city.id);
  const twoEyeLandscape = useSetting('twoEyeLandscape');
  const following = useFollowsMe();

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
        {following ? <FollowingNote /> : null}
        {showTerrainNote ? <TerrainNote /> : null}
      </View>
      <View style={styles.action}>
        <PrimaryButton
          title="Enter Diorama"
          symbol={ENTER_DIORAMA_SYMBOL}
          onPress={enterDiorama}
          accessibilityHint="Opens the city full screen."
        />
        {twoEyeLandscape ? (
          <Text variant="footnote" color="secondaryLabel" style={styles.guidance}>
            Turn your iPhone sideways and place it in your viewer.
          </Text>
        ) : null}
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
