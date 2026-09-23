import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type Query,
} from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { autocomplete, resolve, type PlaceKind } from '@diorama/native';

import { getCuratedCity, type CuratedCity } from './curated';
import { getRecent, type RecentCity } from './recentsStore';

/**
 * A city the app can show, wherever it came from: the curated list, the
 * recents store or a search. Screens treat all three the same way. It's a
 * `RecentCity` plus a camera, so it can go straight into `addRecent`.
 */
export type City = RecentCity & {
  /** Degrees tilted away from straight down. MapKit caps it by altitude. */
  pitch: number;
  /** Compass degrees the camera faces (0 = north). */
  heading: number;
};

/** Camera for cities without a hand-tuned one (recents and search results). */
export const DEFAULT_CAMERA = { pitch: 60, heading: 0 } as const;

/** Wait this long after the last keystroke before searching. */
export const SEARCH_DEBOUNCE_MS = 100;

/** Query keys, so every hook and cache update agrees on them. */
export const cityKeys = {
  all: ['cities'] as const,
  search: (query: string) => ['cities', 'search', query] as const,
  detail: (cityId: string) => ['cities', 'detail', cityId] as const,
};

function fromCurated({ id, name, country, lat, lon, altitude, pitch, heading }: CuratedCity): City {
  return { id, name, country, lat, lon, altitude, pitch, heading };
}

/** Gives a recent city or a search result the default camera. */
export function withDefaultCamera({ id, name, country, lat, lon, altitude }: RecentCity): City {
  return { id, name, country, lat, lon, altitude, ...DEFAULT_CAMERA };
}

/** Curated first, then recents; `null` if neither knows the id. Local data only. */
export function findCity(cityId: string): City | null {
  const curated = getCuratedCity(cityId);
  if (curated) return fromCurated(curated);
  const recent = getRecent(cityId);
  return recent ? withDefaultCamera(recent) : null;
}

/**
 * The city for a `/city/[cityId]` or `/view/[cityId]` route, from local data
 * only: curated cities, then recents (and cities just resolved by
 * `useResolveCity`). It never calls native code or the network, so it works
 * offline and has data on the first render. `data` is `null` for an unknown id.
 */
export function useCity(cityId: string) {
  return useQuery({
    queryKey: cityKeys.detail(cityId),
    queryFn: () => findCity(cityId),
    initialData: () => findCity(cityId),
    // Local data: never wait for a connection.
    networkMode: 'always',
    // A found city never changes (its id pins its coordinates). A missing
    // one is checked again on the next mount, in case it was just added.
    staleTime: (query: Query<City | null>) => (query.state.data ? Infinity : 0),
  });
}

/** `value`, but only after it has stopped changing for `delayMs`. */
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

/**
 * Apple Maps suggestions (cities, addresses, places) for what the user is
 * typing, each with its `kind`. Searches
 * `SEARCH_DEBOUNCE_MS` after the last keystroke, and only for 2+ characters.
 * While a new query loads, the previous results stay (`isPlaceholderData`).
 * Deleting down to 0–1 characters clears the results at once.
 */
export function useCitySearch(query: string) {
  const trimmed = query.trim();
  const debounced = useDebouncedValue(trimmed, SEARCH_DEBOUNCE_MS);
  // Too short: switch off now rather than after the debounce.
  const searchQuery = trimmed.length > 1 ? debounced : trimmed;
  const enabled = searchQuery.length > 1;

  return useQuery({
    queryKey: cityKeys.search(searchQuery),
    queryFn: ({ signal }) => autocomplete(searchQuery, { signal }),
    enabled,
    placeholderData: enabled ? keepPreviousData : undefined,
    // The next keystroke is the retry; retrying a throttled search makes it worse.
    retry: false,
  });
}

/** A resolved search suggestion: a `City`, plus what kind of place it is. */
export type ResolvedPlace = City & {
  /** Decides whether it may stand for a featured city (only cities can). */
  kind: PlaceKind;
};

/**
 * Turns a search suggestion (a city, an address or a place) into a `City`
 * (call `mutate(completion.id)`). The result is cached for `useCity`, so its
 * route renders at once. To keep it across launches, pass it to `addRecent`
 * before navigating.
 */
export function useResolveCity() {
  const queryClient = useQueryClient();
  return useMutation({
    // `resolve` returns a RecentCity-shaped place; this adds the camera.
    mutationFn: async (completionId: string): Promise<ResolvedPlace> => {
      const place = await resolve(completionId);
      return { ...withDefaultCamera(place), kind: place.kind };
    },
    onSuccess: (place) => {
      queryClient.setQueryData(cityKeys.detail(place.id), withDefaultCamera(place));
    },
  });
}
