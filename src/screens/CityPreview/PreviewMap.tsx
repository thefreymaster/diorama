import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { DioramaMapView, type DioramaReadyEvent } from '@diorama/native';
import type { City } from '@/features/cities/queries';
import { colors } from '@/theme';

import { useMapReveal } from './useMapReveal';
import { usePreviewOrbit } from './usePreviewOrbit';

type PreviewMapProps = {
  city: City;
  isReady: boolean;
  onReady: (event: DioramaReadyEvent) => void;
};

/**
 * The whole screen behind the card: one (mono) photoreal 3D map from the
 * city's own camera, turning slowly. The orbit itself runs natively and
 * only starts once the map has drawn.
 */
export function PreviewMap({ city, isReady, onReady }: PreviewMapProps) {
  const orbit = usePreviewOrbit();
  const coverStyle = useMapReveal(isReady);

  return (
    <View style={StyleSheet.absoluteFill}>
      <DioramaMapView
        style={styles.fill}
        center={{ latitude: city.lat, longitude: city.lon }}
        altitude={city.altitude}
        pitch={city.pitch}
        heading={city.heading}
        orbit={orbit}
        onReady={onReady}
        accessible
        accessibilityRole="image"
        accessibilityLabel={`3D map of ${city.name}`}
      />
      <Animated.View style={[StyleSheet.absoluteFill, styles.cover, coverStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  // Same ground as the picker, so the push lands on a calm, familiar color.
  cover: { backgroundColor: colors.systemGroupedBackground, pointerEvents: 'none' },
});
