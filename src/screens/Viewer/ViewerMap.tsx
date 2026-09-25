import type { RefObject } from 'react';
import { StyleSheet } from 'react-native';

import {
  DioramaMapView,
  type DioramaHeadPositionStateEvent,
  type DioramaMapViewRef,
  type DioramaReadyEvent,
  type DioramaViewMode,
} from '@diorama/native';
import type { City } from '@/features/cities/queries';
import { useFollowMyLocation } from '@/features/location/useFollowMyLocation';
import { useCameraAltitude } from '@/features/map/cameraHeight';
import { useSettings } from '@/features/settings/store';

type ViewerMapProps = {
  city: City;
  /** One full-screen picture, or one per eye for the headset (from how the phone is held). */
  mode: DioramaViewMode;
  headTracking: boolean;
  /** Lean to move closer: on in Settings, with camera access. */
  headPosition: boolean;
  /** Every eye has drawn; `event.mode` says which view drew. */
  onReady: (event: DioramaReadyEvent) => void;
  onDegraded: () => void;
  /** Where lean's camera tracking is (for the HUD's hints). */
  onHeadPositionState: (event: DioramaHeadPositionStateEvent) => void;
  ref: RefObject<DioramaMapViewRef | null>;
};

/**
 * The city, edge to edge: one picture, or one round one per eye in stereo,
 * from the city's own camera and the wearer's Settings, viewer fit included
 * (it places and sizes each eye's circle, live). Camera height moves where
 * you stand: the stereo baseline follows the distance, so the depth stays in
 * proportion. A new `mode` keeps the camera, so turning the phone keeps you
 * on the same spot. Head tracking, the eyes and the black cover while they
 * load (again after each switch to stereo) all run natively. In live mode
 * (from Current location) the city glides along with you as you walk or
 * ride, with Apple's blue dot in every eye; your look and zoom stay put.
 * With lean to move closer on, leaning in brings you nearer, as far per
 * lean as Lean distance says.
 */
export function ViewerMap({
  city,
  mode,
  headTracking,
  headPosition,
  onReady,
  onDegraded,
  onHeadPositionState,
  ref,
}: ViewerMapProps) {
  const settings = useSettings();
  const altitude = useCameraAltitude(city.altitude);
  const following = useFollowMyLocation(ref);

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
      headPosition={headPosition}
      leanGain={settings.leanGain}
      miniatureIntensity={settings.miniatureIntensity}
      showsUserLocation={following}
      // Drag to look stands in for the gyro in the Simulator; never in release.
      debugLook={__DEV__ && settings.debugLook}
      onReady={onReady}
      onDegraded={onDegraded}
      onHeadPositionState={onHeadPositionState}
    />
  );
}
