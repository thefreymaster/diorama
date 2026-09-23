import { useAppIsActive } from './useAppIsActive';

/**
 * Whether head tracking runs: once the countdown is over, and only while the
 * app is in front. There's no separate native pause: with tracking off (and
 * no orbit) the view stops its per-frame work and motion sensors, and MapKit
 * doesn't draw in the background. Coming back, wherever the wearer faces
 * becomes straight ahead again.
 */
export function useViewerTracking(isViewing: boolean, recenter: () => void): boolean {
  const isActive = useAppIsActive(() => {
    if (isViewing) recenter();
  });
  return isViewing && isActive;
}
