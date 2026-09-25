import { StyleSheet, View } from 'react-native';

import { PlacePickerMapView, type PlacePickerRegion } from '@diorama/native';
import { useLocationAccess } from '@/features/location/useLocationAccess';

import { CenterPin } from './CenterPin';
import type { PickerStart } from './pickerStart';

type PickerMapProps = {
  start: PickerStart;
  /** Points the card covers at the bottom, so Apple's logo and Legal sit above it. */
  attributionInset: number;
  onRegionChangeEnd: (region: PlacePickerRegion) => void;
};

/**
 * The full-bleed map with the pin in its middle. Apple's blue dot shows
 * where you are only if location access is already on; nothing here asks.
 * To VoiceOver it's one element, "Map", and a drag (after a double-tap and
 * hold) moves it.
 */
export function PickerMap({ start, attributionInset, onRegionChangeEnd }: PickerMapProps) {
  const access = useLocationAccess();

  return (
    <View
      style={StyleSheet.absoluteFill}
      accessible
      accessibilityLabel="Map"
      accessibilityHint="Drag to move the pin."
    >
      <PlacePickerMapView
        testID="place-picker-map"
        style={StyleSheet.absoluteFill}
        center={start.center}
        span={start.span}
        showsUserLocation={access === 'granted'}
        attributionInset={attributionInset}
        onRegionChangeEnd={onRegionChangeEnd}
      />
      <CenterPin />
    </View>
  );
}
