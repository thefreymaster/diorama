import { requireNativeModule } from 'expo';

/** A span of characters in a suggestion's title (JS string indices). */
export type TextRange = {
  start: number;
  length: number;
};

/** One as-you-type suggestion from Apple Maps. Pass `id` to `resolve()`. */
export type Completion = {
  /** Stable for the same suggestion. Use it as the list key. */
  id: string;
  /** "Paris" */
  title: string;
  /** "France". Can be empty. */
  subtitle: string;
  /** The parts of `title` that match the query, to draw in bold. */
  titleHighlights: TextRange[];
};

/**
 * A place from `resolve()`. It has exactly the fields of the app's
 * `RecentCity`, so it can go straight into the recents store.
 */
export type ResolvedCity = {
  /** URL-safe and stable, e.g. `paris_48.857_2.352`. Used in `/city/[cityId]`. */
  id: string;
  name: string;
  /** Country name, e.g. "France". Empty when Apple Maps gives none. */
  country: string;
  lat: number;
  lon: number;
  /** Suggested camera-to-center distance in meters, from the place's size. */
  altitude: number;
};

/** A resolved place as Swift sends it (`PlaceRecord` in DioramaSearchRecords.swift). */
export type NativePlace = {
  name: string;
  country: string;
  latitude: number;
  longitude: number;
  /** The place's size in degrees, north–south and east–west. */
  latitudeDelta: number;
  longitudeDelta: number;
};

/** The search functions in DioramaNativeModule.swift. */
type NativeSearchModule = {
  autocomplete(query: string): Promise<Completion[]>;
  resolve(completionId: string): Promise<NativePlace>;
};

let nativeModule: NativeSearchModule | undefined;

// Loaded on first use, so importing this file never touches native code
// (tests mock these functions instead).
function native(): NativeSearchModule {
  nativeModule ??= requireNativeModule<NativeSearchModule>('DioramaNative');
  return nativeModule;
}

/** Error code Swift uses when a newer `autocomplete()` call replaces an older one. */
export const SEARCH_SUPERSEDED = 'ERR_SEARCH_SUPERSEDED';

/** True for the error an older `autocomplete()` gets when a newer query replaces it. */
export function isSearchSuperseded(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === SEARCH_SUPERSEDED;
}

/**
 * Apple Maps suggestions for cities and addresses (iOS 18+: cities,
 * neighborhoods and regions, no street addresses). Only the newest query
 * gets an answer: a newer call rejects any older one still waiting (see
 * `isSearchSuperseded`), so a slow "Pa" can never land after "Par".
 * `signal` rejects early on abort, which lets TanStack Query drop a query
 * the user typed past.
 */
export function autocomplete(
  query: string,
  { signal }: { signal?: AbortSignal } = {},
): Promise<Completion[]> {
  const request = native().autocomplete(query);
  if (!signal) return request;
  return new Promise((resolve, reject) => {
    const abort = () => reject(new Error('Search aborted'));
    if (signal.aborted) {
      abort();
      return;
    }
    signal.addEventListener('abort', abort, { once: true });
    request.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

/** Turns a suggestion into a place with coordinates and a suggested altitude. */
export async function resolve(completionId: string): Promise<ResolvedCity> {
  return toResolvedCity(await native().resolve(completionId));
}

// Pure helpers (exported for tests)

/** Closest and farthest suggested camera distances, in meters. */
export const SUGGESTED_ALTITUDE_RANGE = { min: 800, max: 3000 } as const;

// The camera sits about a twelfth of the place's width away, so a
// neighborhood gets a close look and a metro a wider one (Paris ≈ 1.5 km,
// like the curated cameras). Apple's regions follow city limits, so they
// are rough; the clamp keeps every answer where Flyover reads as a model:
// a town comes back at 800 m, and Tokyo at 3 km instead of 40 km.
const ALTITUDE_PER_METER_OF_SPAN = 1 / 12;
const METERS_PER_DEGREE = 111_320;

/** Camera distance (meters) that frames a place of this size. */
export function suggestedAltitude({
  latitude,
  latitudeDelta,
  longitudeDelta,
}: Pick<NativePlace, 'latitude' | 'latitudeDelta' | 'longitudeDelta'>): number {
  const northSouth = latitudeDelta * METERS_PER_DEGREE;
  const eastWest = longitudeDelta * METERS_PER_DEGREE * Math.cos((latitude * Math.PI) / 180);
  const span = Math.max(northSouth, eastWest);
  const { min, max } = SUGGESTED_ALTITUDE_RANGE;
  if (!Number.isFinite(span)) return min;
  return Math.round(Math.min(max, Math.max(min, span * ALTITUDE_PER_METER_OF_SPAN)));
}

const MAX_SLUG_LENGTH = 40;

/**
 * A URL-safe id that stays the same each time a place is resolved: a slug
 * of the name plus coordinates rounded to ~100 m, e.g. `paris_48.857_2.352`
 * or `sao-paulo_-23.551_-46.633`. Curated ids have no `_`, so they never clash.
 */
export function placeId(name: string, lat: number, lon: number): string {
  const slug =
    name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // é → e
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, MAX_SLUG_LENGTH)
      .replace(/^-+|-+$/g, '') || 'place';
  return `${slug}_${lat.toFixed(3)}_${lon.toFixed(3)}`;
}

function roundCoordinate(degrees: number): number {
  return Math.round(degrees * 1e6) / 1e6;
}

/** Adds the URL id and suggested altitude to a place from Swift. */
export function toResolvedCity(place: NativePlace): ResolvedCity {
  const lat = roundCoordinate(place.latitude);
  const lon = roundCoordinate(place.longitude);
  return {
    id: placeId(place.name, lat, lon),
    name: place.name,
    country: place.country,
    lat,
    lon,
    altitude: suggestedAltitude(place),
  };
}
