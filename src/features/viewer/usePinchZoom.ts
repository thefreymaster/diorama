import { useRef, type RefObject } from 'react';

import type { DioramaMapViewRef } from '@diorama/native';

/** How far one VoiceOver "Zoom in" moves you: halfway to the middle of the view. */
export const ZOOM_STEP = 2;

/** A two-finger pinch's handlers, for the Viewer's pinch gesture. */
export type PinchZoom = {
  /** The pinch took hold, at `scale` (finger spread ÷ spread as the fingers landed). */
  onStart: (scale: number) => void;
  /** The fingers moved: `scale` as in `onStart`. */
  onPinch: (scale: number) => void;
  /** The fingers lifted, or the pinch was cancelled. */
  onEnd: () => void;
  /** One whole zoom at once (VoiceOver): above 1 nearer, below 1 farther. */
  zoomBy: (scale: number) => void;
};

/**
 * Pinch to zoom, held upright: spreading two fingers moves you toward
 * whatever is in the middle of the view, pinching them together backs you
 * away, and the way you face doesn't change. The map does the moving,
 * frame by frame, natively (`beginZoom`, `setZoom`, `endZoom`); this only
 * passes each step of the gesture along, with the scale counted from where
 * the pinch took hold, so it never starts with a jump.
 *
 * The zoom stays through a recenter. `reset()` takes you back to the
 * place's normal distance (the phone turned); leaving the Viewer drops the
 * map, zoom and all. `release()` lets go of a pinch the gestures can no
 * longer finish (the view stopped following the phone mid-pinch).
 * `isPinching()` tells the one-finger drag to hold still meanwhile.
 */
export function usePinchZoom(mapRef: RefObject<DioramaMapViewRef | null>) {
  // Refs, not state: nothing on screen is drawn from them, and a pinch
  // updates them many times a second.
  const pinching = useRef(false);
  const startScale = useRef(1);

  const end = () => {
    if (!pinching.current) return;
    pinching.current = false;
    void mapRef.current?.endZoom();
  };

  const handlers: PinchZoom = {
    onStart: (scale) => {
      pinching.current = true;
      startScale.current = scale > 0 ? scale : 1;
      void mapRef.current?.beginZoom();
    },
    onPinch: (scale) => {
      if (!pinching.current) return;
      void mapRef.current?.setZoom(scale / startScale.current);
    },
    onEnd: end,
    zoomBy: (scale) => {
      const map = mapRef.current;
      if (!map || pinching.current) return;
      void map.beginZoom();
      void map.setZoom(scale);
      void map.endZoom();
    },
  };

  return {
    handlers,
    isPinching: () => pinching.current,
    release: end,
    reset: () => {
      pinching.current = false;
      void mapRef.current?.resetZoom();
    },
  };
}
