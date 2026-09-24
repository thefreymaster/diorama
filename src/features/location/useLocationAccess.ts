import { useQuery } from '@tanstack/react-query';

import { readLocationAccess, type LocationAccess } from './locateMe';

/** Query keys, so the hooks and their cache updates agree on them. */
export const locationKeys = {
  access: ['location', 'access'] as const,
};

/**
 * What the app may do with location right now, read without asking (never
 * the permission prompt): on mount and each time the app comes back, so a
 * change made in Settings shows up on return. `undefined` until first read.
 * With `enabled` false it doesn't read, only reports what was last read.
 */
export function useLocationAccess(enabled = true): LocationAccess | undefined {
  const access = useQuery({
    queryKey: locationKeys.access,
    queryFn: readLocationAccess,
    enabled,
    // On the device: no connection needed, and cheap to read again.
    networkMode: 'always',
    // Refetches whenever the app returns to the front (see `queryClient`).
    staleTime: 0,
    retry: false,
  });
  return access.data;
}
