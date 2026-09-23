import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useStereoEyes, type DioramaRect, type DioramaStereoEyes } from '@diorama/native';
import { spacing } from '@/theme';

/** From the safe area's top-left corner: the standard iOS side margin. */
const CORNER_MARGIN = spacing.lg;
/** The least black kept between the button and an eye window. */
const EYE_CLEARANCE = spacing.sm;

type Point = { x: number; y: number };
type Insets = { top: number; left: number };

/** True when a square of `size` at `origin` comes within `EYE_CLEARANCE` of `eye`. */
function crowds(origin: Point, size: number, eye: DioramaRect): boolean {
  return (
    origin.x < eye.x + eye.width + EYE_CLEARANCE &&
    origin.x + size > eye.x - EYE_CLEARANCE &&
    origin.y < eye.y + eye.height + EYE_CLEARANCE &&
    origin.y + size > eye.y - EYE_CLEARANCE
  );
}

/**
 * Where the exit button's top-left goes: the safe area's top-left corner,
 * unless that would put it over (or right up against) an eye window. Then
 * it slides left, into the black beside the left eye, or else up, into the
 * black above it, staying inside the safe area. Screen points, like `eyes`.
 */
export function exitButtonOrigin(
  size: number,
  insets: Insets,
  eyes: DioramaStereoEyes | null,
): Point {
  const corner = { x: insets.left + CORNER_MARGIN, y: insets.top + CORNER_MARGIN };
  if (!eyes) return corner;

  const { left } = eyes;
  const candidates: Point[] = [
    corner,
    { x: Math.min(corner.x, left.x - EYE_CLEARANCE - size), y: corner.y },
    { x: corner.x, y: Math.min(corner.y, left.y - EYE_CLEARANCE - size) },
  ];
  const fits = (origin: Point) =>
    origin.x >= insets.left &&
    origin.y >= insets.top &&
    !crowds(origin, size, eyes.left) &&
    !crowds(origin, size, eyes.right);

  // Windows so big they leave no room: better seen than unreachable.
  return candidates.find(fits) ?? corner;
}

/**
 * The exit button's position: in stereo, in the black outside both eye
 * windows (out of sight through the lenses); otherwise, and until the map
 * has reported its windows, the safe area's top-left corner.
 */
export function useExitButtonOrigin(size: number): Point {
  const insets = useSafeAreaInsets();
  const eyes = useStereoEyes();
  return exitButtonOrigin(size, insets, eyes);
}
