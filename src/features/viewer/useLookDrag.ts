import { useRef, type RefObject } from 'react';

import type { DioramaMapViewRef } from '@diorama/native';

/** Degrees the view turns per point dragged: the Simulator's drag-to-look rate. */
export const LOOK_DEGREES_PER_POINT = 0.25;

/** Looking up or down stops here, straight up or down, like a neck. */
const PITCH_LIMIT = 90;

type Look = { yaw: number; pitch: number };

const STRAIGHT_AHEAD: Look = { yaw: 0, pitch: 0 };

/** A one-finger drag's handlers, for the Viewer's pan gesture. */
export type LookDrag = {
  /** A drag began: it turns the view from where the last one left it. */
  onStart: () => void;
  /** Points moved since the drag began: right and down are positive. */
  onDrag: (dx: number, dy: number) => void;
};

/**
 * One finger turns the view held in the hand, the way a finger moves a
 * panorama: the city follows the finger, so dragging left looks right and
 * dragging down looks up. The angle stays here and goes to the map's
 * `setDebugLook`. (Natively that angle only moves a debug-look map so far;
 * on a phone it still has to be added to the motion sensors' look.)
 * `reset()` goes with every recenter, which zeroes it natively too.
 */
export function useLookDrag(mapRef: RefObject<DioramaMapViewRef | null>) {
  // Refs, not state: nothing on screen is drawn from them, and a drag
  // updates them many times a second.
  const look = useRef<Look>(STRAIGHT_AHEAD);
  const dragOrigin = useRef<Look>(STRAIGHT_AHEAD);

  const handlers: LookDrag = {
    onStart: () => {
      dragOrigin.current = look.current;
    },
    onDrag: (dx, dy) => {
      const yaw = dragOrigin.current.yaw - dx * LOOK_DEGREES_PER_POINT;
      const pitch = clamp(dragOrigin.current.pitch + dy * LOOK_DEGREES_PER_POINT, PITCH_LIMIT);
      look.current = { yaw, pitch };
      void mapRef.current?.setDebugLook(yaw, pitch);
    },
  };

  return {
    handlers,
    /** Back to straight ahead, for a recenter. */
    reset: () => {
      look.current = STRAIGHT_AHEAD;
      dragOrigin.current = STRAIGHT_AHEAD;
    },
  };
}

function clamp(value: number, limit: number): number {
  return Math.min(limit, Math.max(-limit, value));
}
