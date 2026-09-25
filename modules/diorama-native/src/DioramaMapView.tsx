import { useEffect, useId, useImperativeHandle, useRef } from 'react';

import type {
  DioramaMapStyle,
  DioramaMapViewProps,
  DioramaMapViewRef,
} from './DioramaMapView.types';
import { forgetEyeLayout, reportEyeLayout } from './eyeLayoutStore';
import { flyoverCoverageAt } from './flyoverCoverage';
import {
  NativeDioramaMapView,
  type NativeCompassStateEvent,
  type NativeDegradedEvent,
  type NativeEyeLayoutEvent,
  type NativeHeadPositionStateEvent,
  type NativeHeadPositionStatsEvent,
  type NativeReadyEvent,
} from './NativeDioramaMapView';

/** Millimeters between Google Cardboard v2's lens centers. */
export const DEFAULT_LENS_SPACING = 64;
/** Millimeters across each stereo eye's round window, filling a 35 mm round lens hole. */
export const DEFAULT_WINDOW_DIAMETER = 35;
/** The map's look when it's told nothing: photoreal 3D imagery. */
export const DEFAULT_MAP_STYLE: DioramaMapStyle = 'satellite';
/** Every map style, in the order a menu lists them. */
export const MAP_STYLES: readonly DioramaMapStyle[] = ['satellite', 'hybrid', 'standard'];

/**
 * The style the map is drawn in: the chosen one, except that satellite
 * imagery can't show traffic, so with traffic on it's drawn with labels
 * (`hybrid`), which can.
 */
export function mapStyleShown(mapStyle: DioramaMapStyle, showsTraffic: boolean): DioramaMapStyle {
  return showsTraffic && mapStyle === 'satellite' ? 'hybrid' : mapStyle;
}

/**
 * A 3D Apple Maps view (photoreal imagery by default, or another
 * `mapStyle`, optionally with live traffic) with a camera driven by props.
 * All per-frame work (orbit, head tracking and position, true north, stereo
 * eyes, tilt-shift) runs natively.
 */
export function DioramaMapView({
  ref,
  onReady,
  onDegraded,
  onEyeLayout,
  onHeadPositionState,
  onHeadPositionStats,
  onCompassState,
  orbit = false,
  headTracking = false,
  debugLook = false,
  trackingSensitivity = 1,
  headPosition = false,
  leanGain = 1,
  leanVertical = true,
  trueNorth = false,
  mode = 'mono',
  eyeSeparation = 1,
  lensSpacing = DEFAULT_LENS_SPACING,
  windowDiameter = DEFAULT_WINDOW_DIAMETER,
  miniatureIntensity = 0,
  showsUserLocation = false,
  mapStyle = DEFAULT_MAP_STYLE,
  showsTraffic = false,
  ...props
}: DioramaMapViewProps) {
  const nativeRef = useRef<DioramaMapViewRef>(null);
  // Tells this map's eye layout apart from any other map's (useStereoEyes).
  const layoutOwner = useId();

  useEffect(() => () => forgetEyeLayout(layoutOwner), [layoutOwner]);

  useImperativeHandle(ref, () => ({
    recenter: async () => {
      await nativeRef.current?.recenter();
    },
    setDebugLook: async (dx, dy) => {
      await nativeRef.current?.setDebugLook(dx, dy);
    },
    beginZoom: async () => {
      await nativeRef.current?.beginZoom();
    },
    setZoom: async (scale) => {
      await nativeRef.current?.setZoom(scale);
    },
    endZoom: async () => {
      await nativeRef.current?.endZoom();
    },
    resetZoom: async () => {
      await nativeRef.current?.resetZoom();
    },
    followTo: async (latitude, longitude) => {
      await nativeRef.current?.followTo(latitude, longitude);
    },
    setDebugLean: async (right, up, forward, tracking = true) => {
      await nativeRef.current?.setDebugLean(right, up, forward, tracking);
    },
  }));

  // Native reports what it drew; 3D coverage comes from the hand-checked lists.
  const handleReady = ({ nativeEvent }: NativeReadyEvent) => {
    onReady?.({ coverage: flyoverCoverageAt(props.center), mode: nativeEvent.mode });
  };

  const handleDegraded = ({ nativeEvent }: NativeDegradedEvent) => {
    onDegraded?.({ reason: nativeEvent.reason });
  };

  const handleEyeLayout = ({ nativeEvent }: NativeEyeLayoutEvent) => {
    const layout = { mode: nativeEvent.mode, left: nativeEvent.left, right: nativeEvent.right };
    reportEyeLayout(layoutOwner, layout);
    onEyeLayout?.(layout);
  };

  const handleHeadPositionState = ({ nativeEvent }: NativeHeadPositionStateEvent) => {
    onHeadPositionState?.({ state: nativeEvent.state });
  };

  const handleCompassState = ({ nativeEvent }: NativeCompassStateEvent) => {
    onCompassState?.({ state: nativeEvent.state });
  };

  // Dev readout only, so the payload passes through as is.
  const handleHeadPositionStats = ({ nativeEvent }: NativeHeadPositionStatsEvent) => {
    onHeadPositionStats?.(nativeEvent);
  };

  return (
    <NativeDioramaMapView
      {...props}
      ref={nativeRef}
      orbit={orbit}
      headTracking={headTracking}
      debugLook={debugLook}
      trackingSensitivity={trackingSensitivity}
      headPosition={headPosition}
      leanGain={leanGain}
      leanVertical={leanVertical}
      trueNorth={trueNorth}
      mode={mode}
      eyeSeparation={eyeSeparation}
      lensSpacing={lensSpacing}
      windowDiameter={windowDiameter}
      miniatureIntensity={miniatureIntensity}
      showsUserLocation={showsUserLocation}
      mapStyle={mapStyleShown(mapStyle, showsTraffic)}
      showsTraffic={showsTraffic}
      onReady={handleReady}
      onDegraded={handleDegraded}
      onEyeLayout={handleEyeLayout}
      onHeadPositionState={handleHeadPositionState}
      onHeadPositionStats={onHeadPositionStats ? handleHeadPositionStats : undefined}
      onCompassState={handleCompassState}
    />
  );
}
