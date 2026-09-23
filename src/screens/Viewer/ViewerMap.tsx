import type { Ref } from 'react';
import { StyleSheet } from 'react-native';

import {
  DioramaMapView,
  type DioramaMapViewRef,
  type DioramaReadyEvent,
  type DioramaViewMode,
} from '@diorama/native';
import type { City } from '@/features/cities/queries';
import { useCameraAltitude } from '@/features/map/cameraHeight';
import { useSettings } from '@/features/settings/store';

type ViewerMapProps = {
  city: City;
  /** One full-screen picture, or one per eye for the headset (from how the phone is held). */
  mode: DioramaViewMode;
  headTracking: boolean;
  /** Every eye has drawn; `event.mode` says which view drew. */
  onReady: (event: DioramaReadyEvent) => void;
  onDegraded: () => void;
  ref: Ref<DioramaMapViewRef>;
};

/**
 * The city, edge to edge: one picture, or one round one per eye in stereo,
 * from the city's own camera and the wearer's Settings, viewer fit included
 * (it places and sizes each eye's circle, live). Camera height moves where
 * you stand: the stereo baseline follows the distance, so the depth stays in
 * proportion. A new `mode` keeps the camera, so turning the phone keeps you
 * on the same spot. Head tracking, the eyes and the black cover while they
 * load (again after each switch to stereo) all run natively.
 */
export function ViewerMap({ city, mode, headTracking, onReady, onDegraded, ref }: ViewerMapProps) {
  const settings = useSettings();
  const altitude = useCameraAltitude(city.altitude);

  return (
    <DioramaMapView
      ref={ref}
      testID="viewer-map"
      style={StyleSheet.absoluteFill}
      center={{ latitude: city.lat, longitude: city.lon }}
      altitude={altitude}
      pitch={city.pitch}
      heading={city.heading}
      mode={mode}
      eyeSeparation={settings.eyeSeparation}
      lensSpacing={settings.lensSpacing}
      windowDiameter={settings.windowDiameter}
      headTracking={headTracking}
      trackingSensitivity={settings.trackingSensitivity}
      miniatureIntensity={settings.miniatureIntensity}
      // Drag to look stands in for the gyro in the Simulator; never in release.
      debugLook={__DEV__ && settings.debugLook}
      onReady={onReady}
      onDegraded={onDegraded}
    />
  );
}
