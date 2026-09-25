import { skipToken, useQuery } from '@tanstack/react-query';
import { Platform } from 'react-native';

import { pointsOfInterest } from '@diorama/native';
import type { RecentCity } from '@/features/cities/recentsStore';
import { iosMajorVersion } from '@/theme';

import {
  orderViewpoints,
  viewpointSearch,
  type Viewpoint,
  type ViewpointSearch,
} from './viewpoints';

/** Query keys, so the preview's row and the sheet share one answer. */
export const viewpointKeys = {
  all: ['viewpoints'] as const,
  place: (placeId: string) => ['viewpoints', placeId] as const,
};

/** Apple Maps has the kinds a Viewpoints list needs from iOS 27. */
export function supportsViewpoints(): boolean {
  return iosMajorVersion(Platform.Version) >= 27;
}

/**
 * Asks Apple Maps for a place's scenic views, then its visitor centers,
 * and lists them (see `orderViewpoints`). A place that isn't a park and
 * has no scenic view gets `[]` without the second request. If only the
 * second request fails, the scenic views still show.
 */
export async function findViewpoints(
  place: RecentCity,
  { radius, isPark }: ViewpointSearch,
): Promise<Viewpoint[]> {
  const scenicViews = await pointsOfInterest(place.lat, place.lon, radius, ['scenicView']);
  if (!isPark && orderViewpoints(place, scenicViews).length === 0) return [];
  const visitorCenters = await pointsOfInterest(place.lat, place.lon, radius, [
    'visitorCenter',
  ]).catch(() => []);
  return orderViewpoints(place, [...scenicViews, ...visitorCenters]);
}

/**
 * A place's Viewpoints list: scenic views first, then visitor centers, each
 * nearest first. Only national parks and natural places ask (see
 * `viewpointSearch`), and only on iOS 27+; everything else gets `[]` at
 * once. The card and the sheet share one answer; a failure (offline, or MapKit's
 * limit of ~100 requests a minute) quietly lists nothing, and the next
 * visit tries again.
 */
export function useViewpoints(place: RecentCity | null) {
  const search = place && supportsViewpoints() ? viewpointSearch(place) : null;
  const query = useQuery({
    queryKey: viewpointKeys.place(place?.id ?? ''),
    queryFn: place && search ? () => findViewpoints(place, search) : skipToken,
    // Viewpoints stay put. The list is kept while anything shows it, and
    // for a few minutes after (the app's default).
    staleTime: Infinity,
    // Retrying a throttled MapKit request only makes it worse.
    retry: false,
  });

  return {
    /** `[]` while loading, when nothing turned up, or when this place doesn't ask. */
    viewpoints: query.data ?? [],
    /** Asking Apple Maps right now, with nothing to show yet. */
    isLoading: query.isLoading,
  };
}
