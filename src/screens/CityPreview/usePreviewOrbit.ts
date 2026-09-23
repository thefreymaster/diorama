import { useIsFocused } from 'expo-router';

import { useReduceMotion } from './useReduceMotion';

/**
 * Whether the preview map turns slowly around the city. Off with Reduce
 * Motion, and paused while another screen (the Viewer, Settings) covers
 * this one, so a hidden map never spends GPU time.
 */
export function usePreviewOrbit(): boolean {
  const isFocused = useIsFocused();
  const reduceMotion = useReduceMotion();
  return isFocused && !reduceMotion;
}
