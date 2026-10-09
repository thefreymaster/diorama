import { useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  PlacePickerMapView,
  type PlacePickerMapViewRef,
  type PlacePickerRegion,
} from '@diorama/native';
import { useLocationAccess } from '@/features/location/useLocationAccess';

import { CenterPin } from './CenterPin';
import { LocateButton } from './LocateButton';
import type { PickerStart } from './pickerStart';
import { useZoomToMe } from './useZoomToMe';

type PickerMapProps = {
  start: PickerStart;
  /** Points the card covers at the bottom, so Apple's logo and Legal sit above it. */
  attributionInset: number;
  onRegionChangeEnd: (region: PlacePickerRegion) => void;
};

/**
 * The full-bleed map with the pin in its middle, and "Show my location" in
 * the top-right corner. Apple's blue dot shows where you are only if
 * location access is already on; only a tap on the button asks. To
 * VoiceOver the map is one element, "Map", and a drag (after a double-tap
 * and hold) moves it.
 */
export function PickerMap({ start, attributionInset, onRegionChangeEnd }: PickerMapProps) {
  const access = useLocationAccess();
  const mapRef = useRef<PlacePickerMapViewRef>(null);
  const zoomToMe = useZoomToMe(mapRef, start);

  const handleRegionChangeEnd = (region: PlacePickerRegion) => {
    zoomToMe.onRegionChangeEnd(region);
    onRegionChangeEnd(region);
  };

  return (
    <>
      <View
        style={StyleSheet.absoluteFill}
        accessible
        accessibilityLabel="Map"
        accessibilityHint="Drag to move the pin."
      >
        <PlacePickerMapView
          ref={mapRef}
          testID="place-picker-map"
          style={StyleSheet.absoluteFill}
          center={start.center}
          span={start.span}
          showsUserLocation={access === 'granted'}
          attributionInset={attributionInset}
          onRegionChangeEnd={handleRegionChangeEnd}
        />
        <CenterPin />
      </View>
      {/* Outside the one "Map" element, so VoiceOver can reach it. */}
      <LocateButton
        onYou={zoomToMe.onYou}
        accessOff={zoomToMe.accessOff}
        onPress={zoomToMe.locate}
      />
    </>
  );
}
