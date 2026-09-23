import type { Ref } from 'react';
import { StyleSheet } from 'react-native';

import { DioramaMapView, type DioramaMapViewRef } from '@diorama/native';
import type { City } from '@/features/cities/queries';
import { useSettings } from '@/features/settings/store';

type ViewerMapProps = {
  city: City;
  headTracking: boolean;
  onReady: () => void;
  onDegraded: () => void;
  ref: Ref<DioramaMapViewRef>;
};

/**
 * The city, edge to edge: one picture, or one per eye in stereo, from the
 * city's own camera and the wearer's Settings. Head tracking, the eyes and
 * the black cover while they load all run natively.
 */
export function ViewerMap({ city, headTracking, onReady, onDegraded, ref }: ViewerMapProps) {
  const settings = useSettings();

  return (
    <DioramaMapView
      ref={ref}
      testID="viewer-map"
      style={StyleSheet.absoluteFill}
      center={{ latitude: city.lat, longitude: city.lon }}
      altitude={city.altitude}
      pitch={city.pitch}
      heading={city.heading}
      mode={settings.mode}
      eyeSeparation={settings.eyeSeparation}
      headTracking={headTracking}
      trackingSensitivity={settings.trackingSensitivity}
      // Drag to look stands in for the gyro in the Simulator; never in release.
      debugLook={__DEV__ && settings.debugLook}
      onReady={onReady}
      onDegraded={onDegraded}
    />
  );
}
