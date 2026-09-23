import { useImperativeHandle, useRef } from 'react';

import type { DioramaMapViewProps, DioramaMapViewRef } from './DioramaMapView.types';
import { hasFlyover } from './flyoverCoverage';
import { NativeDioramaMapView } from './NativeDioramaMapView';

/**
 * A photoreal 3D Apple Maps view with a camera driven by props. All
 * per-frame work (orbit, head tracking; stereo later) runs natively.
 */
export function DioramaMapView({
  ref,
  onReady,
  orbit = false,
  headTracking = false,
  debugLook = false,
  trackingSensitivity = 1,
  ...props
}: DioramaMapViewProps) {
  const nativeRef = useRef<DioramaMapViewRef>(null);

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

  return (
    <NativeDioramaMapView
      {...props}
      ref={nativeRef}
      orbit={orbit}
      headTracking={headTracking}
      debugLook={debugLook}
      trackingSensitivity={trackingSensitivity}
      onReady={handleReady}
    />
  );
}
