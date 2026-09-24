import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AccessibilityInfo, Linking } from 'react-native';

import type { RecentCity } from '@/features/cities/recentsStore';
import { selectionHaptic } from '@/ui';

import { isAccessDenied, locateMe, type LocationAccess } from './locateMe';
import { locationKeys, useLocationAccess } from './useLocationAccess';

/**
 * Where the "Current location" row is: `locating` while it looks, `denied`
 * while location access is off (only Settings can turn it back on), and
 * `unavailable` after a try that found nothing (Location Services off, or
 * no fix in time).
 */
export type LocateStatus = 'idle' | 'locating' | 'denied' | 'unavailable';

/** The line under "Current location" in each status. None when idle. */
export const LOCATE_SUBTITLES = {
  idle: undefined,
  locating: 'Locating…',
  denied: 'Location access is off',
  unavailable: "Can't find your location",
} as const satisfies Record<LocateStatus, string | undefined>;

/**
 * Opens the diorama where you're standing. `locate(onLocated)` asks for
 * location access the first time (never before a tap), finds and names the
 * spot, and hands it to `onLocated` as a place to show. With access off, it
 * opens Diorama's page in Settings instead. Taps while it looks are ignored.
 * The access is read (without asking) on mount and each time the app comes
 * back, so turning it on in Settings clears "Location access is off".
 */
export function useLocateMe() {
  const queryClient = useQueryClient();
  const access = useLocationAccess();

  const mutation = useMutation({
    mutationFn: locateMe,
    networkMode: 'always',
    // Found, so access is on (the prompt may just have turned it on): live
    // mode can follow at once, without waiting for the next read.
    onSuccess: () => queryClient.setQueryData<LocationAccess>(locationKeys.access, 'granted'),
    onError: (error) => {
      const denied = isAccessDenied(error);
      // Now known without waiting for the next read.
      if (denied) queryClient.setQueryData<LocationAccess>(locationKeys.access, 'denied');
      // VoiceOver stays on the row and wouldn't hear its subtitle change.
      AccessibilityInfo.announceForAccessibility(
        denied ? LOCATE_SUBTITLES.denied : LOCATE_SUBTITLES.unavailable,
      );
    },
  });

  const status: LocateStatus = mutation.isPending
    ? 'locating'
    : access === 'denied'
      ? 'denied'
      : mutation.isError && !isAccessDenied(mutation.error)
        ? 'unavailable'
        : 'idle';

  const locate = (onLocated: (place: RecentCity) => void) => {
    if (status === 'locating') return;
    if (status === 'denied') {
      void Linking.openSettings();
      return;
    }
    selectionHaptic();
    mutation.mutate(undefined, { onSuccess: onLocated });
  };

  return { status, locate };
}
