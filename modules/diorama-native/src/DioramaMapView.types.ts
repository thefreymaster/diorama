import type { Ref } from 'react';
import type { ViewProps } from 'react-native';

export type Coordinate = {
  latitude: number;
  longitude: number;
};

export type DioramaReadyEvent = {
  /** True when Apple's photoreal 3D (Flyover) buildings are shown here. */
  flyoverAvailable: boolean;
};

/** Methods on a `ref` to `<DioramaMapView>`. */
export type DioramaMapViewRef = {
  /** Snap back to the camera given by props (drops the orbit angle). */
  recenter: () => Promise<void>;
};

/**
 * Camera props. The native side composes these with its own live offsets
 * (orbit now; head tracking and stereo eyes later), so JS never sends
 * per-frame updates.
 */
export type DioramaCameraProps = {
  /** The point the camera looks at. */
  center: Coordinate;
  /**
   * Meters from the camera to `center` (MapKit's center-coordinate distance).
   * At pitch 0 this is the height above the ground.
   */
  altitude: number;
  /** Degrees tilted away from straight down. MapKit caps it by altitude. */
  pitch: number;
  /** Compass degrees the camera faces (0 = north). */
  heading: number;
};

/**
 * Public props, following the `DioramaMapViewProps` contract in OVERVIEW.md.
 * Later tasks add their props here and in DioramaNativeModule.swift:
 * head tracking (T07), stereo (T08), miniature (T09).
 */
export type DioramaMapViewProps = ViewProps &
  DioramaCameraProps & {
    /** Slow auto-rotate around `center`. Starts after the first full render. */
    orbit?: boolean;
    /** Fires after the first full render at each `center`. */
    onReady?: (event: DioramaReadyEvent) => void;
    ref?: Ref<DioramaMapViewRef>;
  };
