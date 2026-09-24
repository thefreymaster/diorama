import { useEffect, useId, useImperativeHandle, useRef } from 'react';

import type { DioramaMapViewProps, DioramaMapViewRef } from './DioramaMapView.types';
import { forgetEyeLayout, reportEyeLayout } from './eyeLayoutStore';
import { flyoverCoverageAt } from './flyoverCoverage';
import {
  NativeDioramaMapView,
  type NativeDegradedEvent,
  type NativeEyeLayoutEvent,
  type NativeReadyEvent,
} from './NativeDioramaMapView';

/** Millimeters between Google Cardboard v2's lens centers. */
export const DEFAULT_LENS_SPACING = 64;
/** Millimeters across each stereo eye's round window, filling a 35 mm round lens hole. */
export const DEFAULT_WINDOW_DIAMETER = 35;

/**
 * A photoreal 3D Apple Maps view with a camera driven by props. All
 * per-frame work (orbit, head tracking, stereo eyes, tilt-shift) runs natively.
 */
export function DioramaMapView({
  ref,
  onReady,
  onDegraded,
  onEyeLayout,
  orbit = false,
  headTracking = false,
  debugLook = false,
  trackingSensitivity = 1,
  mode = 'mono',
  eyeSeparation = 1,
  lensSpacing = DEFAULT_LENS_SPACING,
  windowDiameter = DEFAULT_WINDOW_DIAMETER,
  miniatureIntensity = 0,
  showsUserLocation = false,
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

  return (
    <NativeDioramaMapView
      {...props}
      ref={nativeRef}
      orbit={orbit}
      headTracking={headTracking}
      debugLook={debugLook}
      trackingSensitivity={trackingSensitivity}
      mode={mode}
      eyeSeparation={eyeSeparation}
      lensSpacing={lensSpacing}
      windowDiameter={windowDiameter}
      miniatureIntensity={miniatureIntensity}
      showsUserLocation={showsUserLocation}
      onReady={handleReady}
      onDegraded={handleDegraded}
      onEyeLayout={handleEyeLayout}
    />
  );
}
