import type { Ref } from 'react';
import type { ViewProps } from 'react-native';

export type Coordinate = {
  latitude: number;
  longitude: number;
};

/**
 * Whether Apple shows photoreal 3D (Flyover) buildings at a place. MapKit has
 * no API for it (none in iOS 27 either), so this comes from places checked by
 * hand: `yes` inside a checked 3D area, `no` inside a checked flat one, and
 * `unknown` everywhere else (Apple may well have 3D there; nobody has looked).
 */
export type FlyoverCoverage = 'yes' | 'no' | 'unknown';

export type DioramaReadyEvent = {
  /**
   * Photoreal 3D (Flyover) coverage at `center`. Only `no` means the view is
   * terrain only; treat `unknown` as "probably fine" and say nothing.
   */
  coverage: FlyoverCoverage;
  /**
   * The view that just finished drawing: `stereo` (both eyes) or `mono`.
   * Usually the `mode` prop, but a mono report can land just after `mode`
   * turned to `stereo` (ignore it: the eyes still have to draw), and a view
   * too hot for two eyes draws `mono` on its own (see `onDegraded`).
   */
  mode: DioramaViewMode;
};

/** One picture, or one per eye side by side for a head-mounted viewer. */
export type DioramaViewMode = 'mono' | 'stereo';

/** A rectangle in the map view's own coordinates, in points. */
export type DioramaRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * Where each eye's picture is drawn in stereo: the square around each eye's
 * circle, so its center is the circle's center.
 */
export type DioramaStereoEyes = {
  left: DioramaRect;
  right: DioramaRect;
};

/** Where each eye's picture is drawn, as reported by `onEyeLayout`. */
export type DioramaEyeLayout = DioramaStereoEyes & {
  /** In `mono` there is one picture, so `left` and `right` are both the whole view. */
  mode: DioramaViewMode;
};

/** Why `onDegraded` fired. */
export type DioramaDegradedEvent = {
  /** `thermal`: the phone got too hot for two maps, so the view went mono. */
  reason: 'thermal';
};

/**
 * Head position (lean to get closer), as `onHeadPositionState` reports it:
 * - `off`: not tracked. The `headPosition` prop is off, or there's no camera
 *   access, no ARKit (the Simulator), the phone is critically hot, or the view
 *   is off screen. Turning your head still works.
 * - `starting`: ARKit is getting its bearings (a second or so; looking around
 *   the room helps). Turning only, meanwhile.
 * - `tracking`: leaning moves you.
 * - `limited`: ARKit lost track (camera covered, a dark room, a blank wall, a
 *   jolt). You stay put for a moment, then ease back to turning only, until
 *   it finds its place again.
 */
export type DioramaHeadPositionState = 'off' | 'starting' | 'tracking' | 'limited';

export type DioramaHeadPositionStateEvent = {
  state: DioramaHeadPositionState;
};

/** A move along the view's own axes, in meters. */
export type DioramaLean = {
  right: number;
  up: number;
  forward: number;
};

/** Dev builds only: head position's numbers, for a readout (the dev map's `stats=1`). */
export type DioramaHeadPositionStats = {
  /** ARKit poses a second (0 with the Simulator's stand-in). */
  framesPerSecond: number;
  /** How old ARKit's newest pose is when a frame is drawn: the lag prediction covers. */
  poseAgeMs: number;
  /** How far each new ARKit pose landed from the prediction (RMS). */
  predictionErrorMm: number;
  /** How much the head's move wobbles (RMS). Read it holding still. */
  jitterMm: number;
  /** The head's move since recenter, smoothed: real meters. */
  move: DioramaLean;
  /** Where that puts you in the city: meters, as the camera props measure them. */
  lean: DioramaLean;
  /** Meters of city per real meter (the stereo's scale × `leanGain`). */
  metersPerMeter: number;
  /** Your height above the model center's ground, in meters. */
  height: number;
  /** Meters to the ground straight ahead (along the resting gaze): the distance leaning is kept within (300 m to 5 km). */
  distance: number;
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
   * Sets a dragged look, in degrees from straight ahead: `dx` > 0 looks
   * right, `dy` > 0 looks up. With debug look it's the whole look;
   * otherwise it adds to the motion look. `recenter()` zeroes it.
   */
  setDebugLook: (dx: number, dy: number) => Promise<void>;
  /**
   * Pinch to zoom, as a pinch starts. Zooming moves where you stand, not
   * the picture: `setZoom` slides you along the gaze toward (or away from)
   * the point in the middle of the view, and the way you face never
   * changes. (Looking near the horizon or at the sky, it zooms along a
   * line 15° below the horizon instead, toward the city ahead.) Only in
   * `mono`, upright (taller than wide), with `headTracking` on; otherwise
   * the zoom calls do nothing.
   * `recenter()` keeps the zoom; new camera props and `resetZoom()` drop it.
   */
  beginZoom: () => Promise<void>;
  /**
   * The pinch's scale since `beginZoom()` (finger spread ÷ spread then):
   * 2 stands half as far from that point, 0.5 twice as far. The distance
   * stays between 300 m and 5 km (like the Camera height setting),
   * stretching a little past either end while the fingers are down.
   * Call once per gesture update; the moving itself runs natively.
   */
  setZoom: (scale: number) => Promise<void>;
  /** The pinch ended: a stretch past either end springs back. */
  endZoom: () => Promise<void>;
  /** Back to the place's normal distance (where the camera props put you). */
  resetZoom: () => Promise<void>;
  /**
   * Head position's stand-in for the Simulator, which has no ARKit: the head
   * moved this far since it started, in meters (`right`, `up`, `forward`;
   * down is a negative `up`). `tracking` false acts as if ARKit lost track.
   * Only with `headTracking`, `headPosition` and `debugLook` on. It goes
   * through the same smoothing, scale and limits as the real thing.
   */
  setDebugLean: (right: number, up: number, forward: number, tracking?: boolean) => Promise<void>;
  /**
   * Live mode: you're now at this spot. The model center (and you with it)
   * glides there natively, both eyes in step: at your own pace while fixes
   * keep coming (it slides from fix to fix over the time between them, so
   * a steady walk or ride is a steady glide), else over about a second;
   * under Reduce Motion, a quick quarter-second glide. Unlike a new
   * `center` prop it isn't a new place: no loading cover, no `onReady`, and
   * the head look, zoom, orbit angle and eye separation all stay. A new
   * `center` prop drops it. Send at most about one fix a second; the
   * smoothing runs natively.
   */
  followTo: (latitude: number, longitude: number) => Promise<void>;
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
   * down tilts you over it, looking up carries on past the city's far edge
   * into haze and sky, all the way to straight up, and tilting your head
   * keeps the city level. Where you face when tracking starts (or on
   * `recenter()`) is straight ahead.
   */
  headTracking?: boolean;
  /**
   * Simulator (no gyro): dragging stands in for the head, and so does
   * `ref.setDebugLook()`. Only has an effect while `headTracking` is on.
   */
  debugLook?: boolean;
  /** How strongly head motion turns the camera. 1 = one to one. */
  trackingSensitivity?: number;
  /**
   * Lean in to get closer: ARKit tracks where the head is (rear camera, no
   * picture shown or kept), and leaning moves where you stand, like leaning
   * over a real tabletop model. Down sinks you toward the city, forward and
   * sideways move you out over it. Needs `headTracking`, and camera access:
   * it never asks for it itself (see `requestCameraAccess()`); without it,
   * it stays `off`. `recenter()` makes wherever the head is now the zero.
   * Works held upright too (move the phone toward the table). Defaults to
   * false.
   */
  headPosition?: boolean;
  /**
   * How far leaning moves you. 1 = true to the model's scale: moving your
   * head by one eye spacing moves you by the stereo's eye baseline (about
   * 375 m per real meter from 1.2 km out). Defaults to 1.
   */
  leanGain?: number;
  /**
   * Head position started, found its place, lost it, or stopped. Fires on
   * each change, and again (with the same state) when the map is ready.
   */
  onHeadPositionState?: (event: DioramaHeadPositionStateEvent) => void;
  /** Dev builds only: head position's numbers, twice a second while it runs. */
  onHeadPositionStats?: (stats: DioramaHeadPositionStats) => void;
};

/**
 * Stereo props. Both eyes are drawn and moved natively in the same frame.
 */
export type DioramaStereoProps = {
  /**
   * `stereo` shows two eyes side by side (landscape, in a viewer), each in a
   * round window centered on one of the viewer's lenses with black around
   * it, and `onReady` waits for both. `mono` fills the view. Defaults to
   * `mono`.
   */
  mode?: DioramaViewMode;
  /**
   * "Model size": multiplies the distance between the eyes (altitude / 50
   * at 1). Bigger reads as a smaller model. Defaults to 1.
   */
  eyeSeparation?: number;
  /**
   * Millimeters between the centers of the viewer's two lenses. In stereo
   * each eye's circle is centered on its lens; the native side converts to
   * points for the phone it runs on. Defaults to 64 (Google Cardboard v2).
   */
  lensSpacing?: number;
  /**
   * Diameter of each eye's round window in stereo, in millimeters: match it
   * to the viewer's round lens holes. The circles never grow wider than
   * `lensSpacing`, so they never overlap, and stop a little short of the
   * screen's height. Larger shows more of the city and makes head tracking
   * turn the camera a little less per degree, since the picture then fills
   * more of your view. Defaults to 35.
   */
  windowDiameter?: number;
  /**
   * Fires with where each eye's picture is, and again whenever that changes
   * (rotation, stereo to mono, a new viewer fit). For drawing something once
   * per eye: in stereo each rect is the square around that eye's circle.
   * `useStereoEyes()` gives the same for the stereo map on screen.
   */
  onEyeLayout?: (layout: DioramaEyeLayout) => void;
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
   * eye (inside its circle in stereo), leaving a sharp strip in the middle, and adds a faint warm tint
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
     * Apple's blue location dot, drawn by every eye's map so it sits at the
     * right depth in stereo. MapKit finds the location itself, so only set
     * it while "while using" location access is on. Defaults to false.
     */
    showsUserLocation?: boolean;
    /**
     * Fires once every eye has fully rendered: after the first render at each
     * `center`, and again after switching to stereo. Until then the view
     * stays black, in every mode, and it shows the city at this very moment
     * (stereo fades in; mono appears at once, ready for a cover of your own).
     */
    onReady?: (event: DioramaReadyEvent) => void;
    ref?: Ref<DioramaMapViewRef>;
  };
