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

/** One picture, or one per eye side by side for a head-mounted viewer. */
export type DioramaViewMode = 'mono' | 'stereo';

/** Why `onDegraded` fired. */
export type DioramaDegradedEvent = {
  /** `thermal`: the phone got too hot for two maps, so the view went mono. */
  reason: 'thermal';
};

/** iOS thermal states, coolest to hottest. */
export type DioramaThermalState = 'nominal' | 'fair' | 'serious' | 'critical';

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
 * (orbit, head tracking, stereo eyes), so JS never sends per-frame updates.
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
 * Stereo props. Both eyes are drawn and moved natively in the same frame.
 */
export type DioramaStereoProps = {
  /**
   * `stereo` shows two eyes side by side (landscape, in a viewer), each at
   * half width. While the eyes load the view stays black, and `onReady`
   * waits for both. Defaults to `mono`.
   */
  mode?: DioramaViewMode;
  /**
   * "Model size": multiplies the distance between the eyes (altitude / 30
   * at 1). Bigger reads as a smaller model. Defaults to 1.
   */
  eyeSeparation?: number;
  /**
   * The view changed on its own to cope: when the phone gets critically hot,
   * stereo falls back to mono until `mode` is set again. (When it is merely
   * hot, the view quietly drops to 30 frames a second.)
   */
  onDegraded?: (event: DioramaDegradedEvent) => void;
  /** Dev builds only: pretend the phone is this hot (the Simulator never is). */
  debugThermalState?: DioramaThermalState;
};

/**
 * The miniature look, drawn natively and identically in every eye.
 */
export type DioramaMiniatureProps = {
  /**
   * Tilt-shift strength, 0 to 1: blurs bands at the top and bottom of each
   * eye, leaving a sharp strip in the middle, and adds a faint warm tint
   * that gives the gray city a little more color. Higher means taller bands,
   * stronger blur and more tint. The bands stay level with the screen under
   * head tracking. Defaults to 0 (off).
   */
  miniatureIntensity?: number;
};

/**
 * Public props, following the `DioramaMapViewProps` contract in OVERVIEW.md.
 * New props go here and in DioramaNativeModule.swift.
 */
export type DioramaMapViewProps = ViewProps &
  DioramaCameraProps &
  DioramaHeadTrackingProps &
  DioramaStereoProps &
  DioramaMiniatureProps & {
    /** Slow auto-rotate around `center`. Starts after the first full render. */
    orbit?: boolean;
    /**
     * Fires once every eye has fully rendered: after the first render at each
     * `center`, and again after switching to stereo.
     */
    onReady?: (event: DioramaReadyEvent) => void;
    ref?: Ref<DioramaMapViewRef>;
  };
