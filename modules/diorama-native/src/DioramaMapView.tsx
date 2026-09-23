import { useEffect, useId, useImperativeHandle, useRef } from 'react';

import type { DioramaMapViewProps, DioramaMapViewRef } from './DioramaMapView.types';
import { forgetEyeLayout, reportEyeLayout } from './eyeLayoutStore';
import { hasFlyover } from './flyoverCoverage';
import {
  NativeDioramaMapView,
  type NativeDegradedEvent,
  type NativeEyeLayoutEvent,
} from './NativeDioramaMapView';

/** Millimeters between Google Cardboard v2's lens centers. */
export const DEFAULT_LENS_SPACING = 64;

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
  miniatureIntensity = 0,
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
  }));

  // Native reports "rendered"; 3D coverage comes from the curated list.
  const handleReady = () => {
    onReady?.({ flyoverAvailable: hasFlyover(props.center) });
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
      miniatureIntensity={miniatureIntensity}
      onReady={handleReady}
      onDegraded={handleDegraded}
      onEyeLayout={handleEyeLayout}
    />
  );
}
