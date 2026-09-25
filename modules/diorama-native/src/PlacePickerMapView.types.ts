import type { ViewProps } from 'react-native';

import type { Coordinate } from './DioramaMapView.types';

/**
 * Where the picker map came to rest, as `onRegionChangeEnd` reports it: the
 * spot under the pin (the middle of the view) and how much map shows.
 */
export type PlacePickerRegion = Coordinate & {
  /** Meters across the view, left edge to right edge through the middle. */
  spanMeters: number;
};

/**
 * An interactive, flat, north-up Apple map (satellite with roads, labels and
 * points of interest) that you move under a pin drawn over its middle: pan
 * and pinch move the map, a tap brings that spot to the middle. Draw the pin
 * yourself, centered on the view.
 */
export type PlacePickerMapViewProps = ViewProps & {
  /**
   * Where the map starts: the spot in its middle. A new value moves the map
   * there; the same value again (a re-render) leaves the user's panning alone.
   */
  center: Coordinate;
  /** Meters across the view at the start. Default 2000. */
  span?: number;
  /**
   * Apple's blue location dot, shown only if location access was already
   * granted. The map never asks for access. Default false.
   */
  showsUserLocation?: boolean;
  /**
   * Points at the bottom of the view covered by something (a card): MapKit's
   * logo and Legal link, which Apple requires to stay visible, sit just above.
   * The top gets the same margin, so the middle of the map stays the middle
   * of the view. Default 0.
   */
  attributionInset?: number;
  /** The map came to rest after a pan, pinch or tap, and once it has shown the start. */
  onRegionChangeEnd?: (region: PlacePickerRegion) => void;
};
