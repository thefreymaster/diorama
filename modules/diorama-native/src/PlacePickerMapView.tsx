import { requireNativeView } from 'expo';
import type { ComponentType } from 'react';
import type { NativeSyntheticEvent } from 'react-native';

import type { PlacePickerMapViewProps, PlacePickerRegion } from './PlacePickerMapView.types';

/** Props exactly as the Swift view (PlacePickerMapView.swift) receives them. */
type NativePlacePickerMapViewProps = Omit<PlacePickerMapViewProps, 'onRegionChangeEnd'> & {
  onRegionChangeEnd?: (event: NativeSyntheticEvent<PlacePickerRegion>) => void;
};

/** The raw native component: the module's second view, after DioramaMapView. */
const NativePlacePickerMapView: ComponentType<NativePlacePickerMapViewProps> = requireNativeView(
  'DioramaNative',
  'PlacePickerMapView',
);

/** Meters across the view when no `span` is given: a neighborhood. */
export const DEFAULT_PICKER_SPAN = 2000;

/**
 * An Apple map you move under a pin to pick a spot ("Choose on map"). All
 * the panning, pinching and tapping runs natively; JS hears only where the
 * map comes to rest (`onRegionChangeEnd`).
 */
export function PlacePickerMapView({
  span = DEFAULT_PICKER_SPAN,
  showsUserLocation = false,
  attributionInset = 0,
  onRegionChangeEnd,
  ...props
}: PlacePickerMapViewProps) {
  const handleRegionChangeEnd = ({ nativeEvent }: NativeSyntheticEvent<PlacePickerRegion>) => {
    const { latitude, longitude, spanMeters } = nativeEvent;
    onRegionChangeEnd?.({ latitude, longitude, spanMeters });
  };

  return (
    <NativePlacePickerMapView
      {...props}
      span={span}
      showsUserLocation={showsUserLocation}
      attributionInset={attributionInset}
      onRegionChangeEnd={handleRegionChangeEnd}
    />
  );
}
