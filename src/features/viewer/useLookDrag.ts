import { useRef, type RefObject } from 'react';

import type { DioramaMapViewRef } from '@diorama/native';

/** Degrees the view turns per point dragged: the Simulator's drag-to-look rate. */
export const LOOK_DEGREES_PER_POINT = 0.25;

/** Looking up or down stops here, straight up or down, like a neck. */
const PITCH_LIMIT = 90;

type Look = { yaw: number; pitch: number };

type Point = { dx: number; dy: number };

const STRAIGHT_AHEAD: Look = { yaw: 0, pitch: 0 };

const NOWHERE: Point = { dx: 0, dy: 0 };

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
 *
 * `isHeld` says whether a pinch has the fingers right now: while it does,
 * the finger that started the drag moves with the pinch, so the view holds
 * still, and once the pinch lets go the drag carries on from there.
 */
export function useLookDrag(mapRef: RefObject<DioramaMapViewRef | null>, isHeld: () => boolean) {
  // Refs, not state: nothing on screen is drawn from them, and a drag
  // updates them many times a second.
  const look = useRef<Look>(STRAIGHT_AHEAD);
  const dragOrigin = useRef<Look>(STRAIGHT_AHEAD);
  // Where the finger was (from where the drag began) when `dragOrigin` was taken.
  const fingerOrigin = useRef<Point>(NOWHERE);
  // A pinch held the drag: the next move starts it afresh from there.
  const wasHeld = useRef(false);

  const handlers: LookDrag = {
    onStart: () => {
      dragOrigin.current = look.current;
      fingerOrigin.current = NOWHERE;
      wasHeld.current = false;
    },
    onDrag: (dx, dy) => {
      if (isHeld()) {
        wasHeld.current = true;
        return;
      }
      if (wasHeld.current) {
        wasHeld.current = false;
        dragOrigin.current = look.current;
        fingerOrigin.current = { dx, dy };
      }
      const moved = { dx: dx - fingerOrigin.current.dx, dy: dy - fingerOrigin.current.dy };
      const yaw = dragOrigin.current.yaw - moved.dx * LOOK_DEGREES_PER_POINT;
      const pitch = clamp(
        dragOrigin.current.pitch + moved.dy * LOOK_DEGREES_PER_POINT,
        PITCH_LIMIT,
      );
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
      fingerOrigin.current = NOWHERE;
      wasHeld.current = false;
    },
  };
}

function clamp(value: number, limit: number): number {
  return Math.min(limit, Math.max(-limit, value));
}
