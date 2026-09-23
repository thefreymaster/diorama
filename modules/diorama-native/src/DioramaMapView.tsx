import { useImperativeHandle, useRef } from 'react';

import type { DioramaMapViewProps, DioramaMapViewRef } from './DioramaMapView.types';
import { hasFlyover } from './flyoverCoverage';
import { NativeDioramaMapView } from './NativeDioramaMapView';

/**
 * A photoreal 3D Apple Maps view with a camera driven by props. All
 * per-frame work (orbit now; head tracking and stereo later) runs natively.
 */
export function DioramaMapView({ ref, onReady, orbit = false, ...props }: DioramaMapViewProps) {
  const nativeRef = useRef<DioramaMapViewRef>(null);

  useImperativeHandle(ref, () => ({
    recenter: async () => {
      await nativeRef.current?.recenter();
    },
  }));

  // Native reports "rendered"; 3D coverage comes from the curated list.
  const handleReady = () => {
    onReady?.({ flyoverAvailable: hasFlyover(props.center) });
  };

  return <NativeDioramaMapView {...props} ref={nativeRef} orbit={orbit} onReady={handleReady} />;
}
