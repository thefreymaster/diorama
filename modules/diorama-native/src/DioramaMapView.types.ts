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
  /**
   * Back to the camera given by props: drops the orbit angle, and wherever
   * the head faces now becomes straight ahead.
   */
  recenter: () => Promise<void>;
  /**
   * Debug look only: sets the fake head angle, in degrees from straight
   * ahead. `dx` > 0 looks right, `dy` > 0 looks up. `recenter()` zeroes it.
   */
  setDebugLook: (dx: number, dy: number) => Promise<void>;
};

/**
 * Camera props. The native side composes these with its own live offsets
 * (orbit, head tracking; stereo eyes later), so JS never sends per-frame
 * updates.
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
 * Head tracking props. All the per-frame work (sensors, smoothing, camera)
 * runs natively; these only switch it on and tune it.
 */
export type DioramaHeadTrackingProps = {
  /**
   * Turn the camera with the wearer's head: turning turns the city, looking
   * down tilts you over it, and tilting your head keeps the city level.
   * Where you face when tracking starts (or on `recenter()`) is straight ahead.
   */
  headTracking?: boolean;
  /**
   * Simulator (no gyro): dragging stands in for the head, and so does
   * `ref.setDebugLook()`. Only has an effect while `headTracking` is on.
   */
  debugLook?: boolean;
  /** How strongly head motion turns the camera. 1 = one to one. */
  trackingSensitivity?: number;
};

/**
 * Public props, following the `DioramaMapViewProps` contract in OVERVIEW.md.
 * Later tasks add their props here and in DioramaNativeModule.swift:
 * stereo (T08), miniature (T09).
 */
export type DioramaMapViewProps = ViewProps &
  DioramaCameraProps &
  DioramaHeadTrackingProps & {
    /** Slow auto-rotate around `center`. Starts after the first full render. */
    orbit?: boolean;
    /** Fires after the first full render at each `center`. */
    onReady?: (event: DioramaReadyEvent) => void;
    ref?: Ref<DioramaMapViewRef>;
  };
