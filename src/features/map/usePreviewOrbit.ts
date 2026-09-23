import { useIsFocused } from 'expo-router';

import { useReduceMotion } from '@/theme';

/**
 * Whether a preview map (the city preview, the Settings preview) turns
 * slowly around its city. Off with Reduce Motion, and paused while another
 * screen covers this one, so a hidden map never spends GPU time.
 */
export function usePreviewOrbit(): boolean {
  const isFocused = useIsFocused();
  const reduceMotion = useReduceMotion();
  return isFocused && !reduceMotion;
}
