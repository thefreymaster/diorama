import { requireNativeModule } from 'expo';

/** A span of characters in a suggestion's title (JS string indices). */
export type TextRange = {
  start: number;
  length: number;
};

/**
 * What a place is, which decides its section, its icon and how close the
 * camera starts: a city (or neighborhood, or region), a street address, or
 * a place such as a landmark, a business or a mountain.
 */
export type PlaceKind = 'city' | 'address' | 'place';

/** One as-you-type suggestion from Apple Maps. Pass `id` to `resolve()`. */
export type Completion = {
  /** Stable for the same suggestion. Use it as the list key. */
  id: string;
  /** "Paris", "1 Infinite Loop", "Eiffel Tower" */
  title: string;
  /** "France", "Cupertino, CA, United States". Can be empty. */
  subtitle: string;
  /** The parts of `title` that match the query, to draw in bold. */
  titleHighlights: TextRange[];
  /** Best guess from the suggestion alone; `resolve()` settles it. */
  kind: PlaceKind;
};

/** A suggestion as Swift sends it (`CompletionRecord` in DioramaSearchRecords.swift). */
export type NativeCompletion = Omit<Completion, 'kind'> & {
  /** In Apple's city list. Before iOS 18 that list has street addresses too. */
  isCity: boolean;
};

/**
 * A place from `resolve()`: the fields of the app's `RecentCity`, so it
 * can go straight into the recents store, plus its kind.
 */
export type ResolvedCity = {
  /** URL-safe and stable, e.g. `paris_48.857_2.352`. Used in `/city/[cityId]`. */
  id: string;
  /** "Paris", "1 Infinite Loop", "Eiffel Tower" */
  name: string;
  /**
   * The line under the name. A city's country ("France"); for an address
   * or a place, its town and country ("Cupertino, United States"). Empty
   * when Apple Maps gives none.
   */
  country: string;
  lat: number;
  lon: number;
  /** Suggested camera-to-center distance in meters, from the kind and size. */
  altitude: number;
  kind: PlaceKind;
};

/** A resolved place as Swift sends it (`PlaceRecord` in DioramaSearchRecords.swift). */
export type NativePlace = {
  name: string;
  country: string;
  /** The town it's in ("Cupertino"). For a city, often its own name. Can be empty. */
  locality: string;
  latitude: number;
  longitude: number;
  /** The place's size in degrees, north–south and east–west. */
  latitudeDelta: number;
  longitudeDelta: number;
  /** Apple's category for a landmark or business ("MKPOICategoryLandmark"), else empty. */
  category: string;
  /** Suggested as a city (iOS 18+ only). False when unknown. */
  isCity: boolean;
};

/** The search functions in DioramaNativeModule.swift. */
type NativeSearchModule = {
  autocomplete(query: string): Promise<NativeCompletion[]>;
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
 * Apple Maps suggestions for cities, street addresses and places
 * (landmarks, businesses), each with its kind. Only the newest query gets
 * an answer: a newer call rejects any older one still waiting (see
 * `isSearchSuperseded`), so a slow "Pa" can never land after "Par".
 * `signal` rejects early on abort, which lets TanStack Query drop a query
 * the user typed past.
 */
export function autocomplete(
  query: string,
  { signal }: { signal?: AbortSignal } = {},
): Promise<Completion[]> {
  const request = native()
    .autocomplete(query)
    .then((completions) => completions.map(toCompletion));
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

/** Turns a suggestion into a place with coordinates, a kind and a suggested altitude. */
export async function resolve(completionId: string): Promise<ResolvedCity> {
  return toResolvedCity(await native().resolve(completionId));
}

// Pure helpers (exported for tests)

/** Kind of a suggestion, for its section and icon, from the suggestion alone. */
export function completionKind({
  isCity,
  subtitle,
}: Pick<NativeCompletion, 'isCity' | 'subtitle'>): PlaceKind {
  if (isCity) return 'city';
  // A landmark or business comes with its street address, which has a
  // number or a postcode: "Eiffel Tower, 5 Avenue Anatole France, 75007
  // Paris". A street comes with just its town: "Cupertino, CA, United
  // States". A place without an address gets the pin too, which is also
  // the icon for "somewhere on the map".
  return /\d/.test(subtitle) ? 'place' : 'address';
}

/** Adds the kind to a suggestion from Swift. */
export function toCompletion({ isCity, ...completion }: NativeCompletion): Completion {
  return { ...completion, kind: completionKind({ isCity, subtitle: completion.subtitle }) };
}

function sameText(a: string, b: string): boolean {
  return a.localeCompare(b, undefined, { sensitivity: 'base' }) === 0;
}

/** What a resolved place is. Apple's own facts about it beat the suggestion's guess. */
export function placeKind({
  name,
  locality,
  category,
  isCity,
}: Pick<NativePlace, 'name' | 'locality' | 'category' | 'isCity'>): PlaceKind {
  // Apple files landmarks, businesses and parks under a category.
  if (category !== '') return 'place';
  if (isCity) return 'city';
  // A street address has a name of its own inside a town ("1 Infinite Loop"
  // in Cupertino). A city is its own town, or has none (Tokyo).
  return locality !== '' && !sameText(locality, name) ? 'address' : 'city';
}

/** Closest and farthest suggested camera distances for a city, in meters. */
export const SUGGESTED_ALTITUDE_RANGE = { min: 800, max: 3000 } as const;

/**
 * Camera distances for an address and for a place, in meters: a block or
 * two. A place is often big or tall (a bridge, a tower, a park), so it gets
 * a little more room than a front door.
 */
export const PLACE_ALTITUDES = { address: 700, place: 900 } as const;

// The camera sits about a twelfth of the place's width away, so a
// neighborhood gets a close look and a metro a wider one (Paris ≈ 1.5 km,
// like the curated cameras). Apple's regions follow city limits, so they
// are rough; the clamp keeps every answer where Flyover reads as a model:
// a town comes back at 800 m, and Tokyo at 3 km instead of 40 km.
const ALTITUDE_PER_METER_OF_SPAN = 1 / 12;
const METERS_PER_DEGREE = 111_320;

/**
 * Camera distance (meters) that frames a place of this size and kind.
 * Cities scale with their size; an address or a place gets a fixed close
 * look, since Apple's box around a single spot is a default, not its size.
 */
export function suggestedAltitude(
  {
    latitude,
    latitudeDelta,
    longitudeDelta,
  }: Pick<NativePlace, 'latitude' | 'latitudeDelta' | 'longitudeDelta'>,
  kind: PlaceKind = 'city',
): number {
  if (kind !== 'city') return PLACE_ALTITUDES[kind];
  const northSouth = latitudeDelta * METERS_PER_DEGREE;
  const eastWest = longitudeDelta * METERS_PER_DEGREE * Math.cos((latitude * Math.PI) / 180);
  const span = Math.max(northSouth, eastWest);
  const { min, max } = SUGGESTED_ALTITUDE_RANGE;
  if (!Number.isFinite(span)) return min;
  return Math.round(Math.min(max, Math.max(min, span * ALTITUDE_PER_METER_OF_SPAN)));
}

/**
 * The line under a place's name: a city's country ("France"), or an
 * address's or place's town and country ("Cupertino, United States").
 */
export function placeSubtitle(
  { name, locality, country }: Pick<NativePlace, 'name' | 'locality' | 'country'>,
  kind: PlaceKind,
): string {
  if (kind === 'city') return country;
  const parts: string[] = [];
  for (const part of [locality, country]) {
    if (part === '' || sameText(part, name) || parts.some((seen) => sameText(seen, part))) continue;
    parts.push(part);
  }
  return parts.join(', ');
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

/** Adds the kind, URL id, subtitle and suggested altitude to a place from Swift. */
export function toResolvedCity(place: NativePlace): ResolvedCity {
  const kind = placeKind(place);
  const lat = roundCoordinate(place.latitude);
  const lon = roundCoordinate(place.longitude);
  return {
    id: placeId(place.name, lat, lon),
    name: place.name,
    country: placeSubtitle(place, kind),
    lat,
    lon,
    altitude: suggestedAltitude(place, kind),
    kind,
  };
}
