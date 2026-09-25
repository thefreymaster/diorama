import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { DioramaMapView } from '@diorama/native';
import { useCameraAltitude } from '@/features/map/cameraHeight';
import { useMapReveal } from '@/features/map/useMapReveal';
import { usePreviewOrbit } from '@/features/map/usePreviewOrbit';
import { useSetting } from '@/features/settings/store';
import { colors } from '@/theme';

import { useSampleCity } from './useSampleCity';

/** Landscape, like the Viewer, so the blurred bands read the same way. */
const ASPECT_RATIO = 3 / 2;

/**
 * A small live picture of a city in the miniature look, from the chosen
 * camera height and in the map style chosen on the preview, so a slider
 * move shows at once. One (mono) map, turning slowly unless Reduce Motion
 * is on. It's only a picture: touches pass through to the list.
 */
export function SettingsPreviewMap() {
  const city = useSampleCity();
  const altitude = useCameraAltitude(city.altitude);
  const miniatureIntensity = useSetting('miniatureIntensity');
  const mapStyle = useSetting('mapStyle');
  const orbit = usePreviewOrbit();
  const [isReady, setReady] = useState(false);
  const coverStyle = useMapReveal(isReady);

  return (
    <View style={styles.frame}>
      <DioramaMapView
        testID="settings-preview-map"
        style={StyleSheet.absoluteFill}
        center={{ latitude: city.lat, longitude: city.lon }}
        altitude={altitude}
        pitch={city.pitch}
        heading={city.heading}
        miniatureIntensity={miniatureIntensity}
        mapStyle={mapStyle}
        orbit={orbit}
        onReady={() => setReady(true)}
        accessible
        accessibilityRole="image"
        accessibilityLabel={`Preview of ${city.name}`}
      />
      <Animated.View style={[StyleSheet.absoluteFill, styles.cover, coverStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { aspectRatio: ASPECT_RATIO, pointerEvents: 'none' },
  // The card's own color while the map loads, so it fades in from nothing.
  cover: { backgroundColor: colors.secondarySystemGroupedBackground },
});
