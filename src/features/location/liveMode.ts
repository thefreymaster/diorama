import { useLocalSearchParams } from 'expo-router';

import { useLocationAccess } from './useLocationAccess';

/**
 * The search param that opens a place in live mode: `/city/<id>?live=1`,
 * and on to `/view/<id>?live=1`. Only "Current location" opens one; the same
 * place reopened from Recent is a fixed place, with no param.
 */
export const LIVE_PARAM = '1';

/** The params that carry live mode on to the next route (none when fixed). */
export function liveParams(live: boolean): { live?: string } {
  return live ? { live: LIVE_PARAM } : {};
}

/**
 * True when this route was opened in live mode (`?live=1`): the map
 * follows you as you move, while location access is on (`useFollowsMe`).
 */
export function useLiveMode(): boolean {
  const { live } = useLocalSearchParams<{ live?: string }>();
  return live === LIVE_PARAM;
}

/**
 * True while this live route can follow you: live mode, with location
 * access on. With access turned off since, the map quietly stays on the
 * fixed place, and nothing says it's following.
 */
export function useFollowsMe(): boolean {
  const live = useLiveMode();
  // Only a live route needs to know.
  const access = useLocationAccess(live);
  return live && access === 'granted';
}
