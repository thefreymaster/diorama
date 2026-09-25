import { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { DioramaMapView, type DioramaMapViewRef, type DioramaReadyEvent } from '@diorama/native';
import type { City } from '@/features/cities/queries';
import { useFollowMyLocation } from '@/features/location/useFollowMyLocation';
import { useCameraAltitude } from '@/features/map/cameraHeight';
import { useMapReveal } from '@/features/map/useMapReveal';
import { usePreviewOrbit } from '@/features/map/usePreviewOrbit';
import { useSetting } from '@/features/settings/store';
import { colors } from '@/theme';

type PreviewMapProps = {
  city: City;
  isReady: boolean;
  onReady: (event: DioramaReadyEvent) => void;
};

/**
 * The whole screen behind the card: one (mono) 3D map from the city's own
 * camera, at the Camera height set in Settings, turning slowly, in the map
 * style chosen from the header's map menu, with live traffic if it's on
 * there (both change in place: the orbit carries on). The orbit itself runs natively and only starts once the map
 * has drawn. In live mode the city glides along with you, around Apple's
 * blue dot.
 */
export function PreviewMap({ city, isReady, onReady }: PreviewMapProps) {
  const mapRef = useRef<DioramaMapViewRef>(null);
  const altitude = useCameraAltitude(city.altitude);
  const orbit = usePreviewOrbit();
  const coverStyle = useMapReveal(isReady);
  const following = useFollowMyLocation(mapRef);
  const mapStyle = useSetting('mapStyle');
  const showsTraffic = useSetting('showsTraffic');

  return (
    <View style={StyleSheet.absoluteFill}>
      <DioramaMapView
        ref={mapRef}
        style={styles.fill}
        center={{ latitude: city.lat, longitude: city.lon }}
        altitude={altitude}
        pitch={city.pitch}
        heading={city.heading}
        orbit={orbit}
        mapStyle={mapStyle}
        showsTraffic={showsTraffic}
        showsUserLocation={following}
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
