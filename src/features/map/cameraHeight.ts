import { useSetting } from '@/features/settings/store';

/**
 * The nearest and farthest a camera may stand from the point it looks at, in
 * meters, whatever the Camera height setting asks for. Nearer than this
 * there's little city left in view; farther, MapKit holds the camera almost
 * straight down and the buildings flatten out.
 */
export const CAMERA_DISTANCE = { min: 300, max: 5000 } as const;

/**
 * A place's camera distance (`altitude`, meters from the camera to the point
 * it looks at) with the Camera height setting applied: `cameraHeight` times
 * as far, kept within `CAMERA_DISTANCE`. At 1× it's the place's own framing.
 */
export function cameraAltitude(placeAltitude: number, cameraHeight: number): number {
  const altitude = placeAltitude * cameraHeight;
  return Math.min(CAMERA_DISTANCE.max, Math.max(CAMERA_DISTANCE.min, altitude));
}

/**
 * `cameraAltitude` for the wearer's Camera height, for a map's `altitude`
 * prop. Follows the setting live, so a map moves as the slider does.
 */
export function useCameraAltitude(placeAltitude: number): number {
  return cameraAltitude(placeAltitude, useSetting('cameraHeight'));
}
