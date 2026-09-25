import {
  PLACE_ALTITUDES,
  distanceKm,
  type Coordinate,
  type PointOfInterest,
  type PointOfInterestCategory,
} from '@diorama/native';
import { getCuratedCity } from '@/features/cities/curated';
import type { RecentCity } from '@/features/cities/recentsStore';

/** A point of interest in a place's Viewpoints list. */
export type Viewpoint = PointOfInterest & {
  /** Meters from the center of the place whose list it's in. */
  distance: number;
};

/** How far around a place to look, in meters. */
export const VIEWPOINT_RADIUS = { park: 25_000, min: 2_000, max: 25_000 } as const;

/**
 * Search radius per meter of camera distance, for places that aren't
 * parks: a landmark framed from 900 m looks ~6 km around.
 */
const RADIUS_PER_ALTITUDE = 7;

/**
 * Camera distance, in meters, of a viewpoint opened as a place: a scenic
 * view takes in the view it's named for; anything else (a visitor center)
 * frames like any searched place (T25).
 */
export const VIEWPOINT_ALTITUDES = { scenicView: 1200, other: PLACE_ALTITUDES.place } as const;

/** Where and how to look for a place's viewpoints. */
export type ViewpointSearch = {
  /** Meters around the place's center. */
  radius: number;
  /**
   * A national park lists whatever turns up. Any other place gets a list
   * only if a scenic view turns up, and asks for nothing more without one.
   */
  isPark: boolean;
};

/**
 * Whether a place is a landmark, a park or a mountain (T25's kind `place`)
 * or a viewpoint opened from a list. Recent doesn't keep a place's kind,
 * but T25 opens every such place at the same camera distance (900 m), and
 * a scenic view opens at its own (1200 m). Cities (sized by their area,
 * rarely exactly these), addresses (700 m) and spots chosen on a map
 * don't, so their previews never ask Apple for viewpoints.
 */
export function isNaturalPlace(place: RecentCity): boolean {
  return (
    getCuratedCity(place.id) === undefined &&
    (place.altitude === VIEWPOINT_ALTITUDES.other ||
      place.altitude === VIEWPOINT_ALTITUDES.scenicView)
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * How to look for a place's viewpoints, or `null` to not ask Apple at all
 * (MapKit allows ~100 requests a minute, so cities and addresses don't
 * ask). National parks look 25 km around; other natural places as far as
 * their framing suggests.
 */
export function viewpointSearch(place: RecentCity): ViewpointSearch | null {
  if (getCuratedCity(place.id)?.category === 'park') {
    return { radius: VIEWPOINT_RADIUS.park, isPark: true };
  }
  if (!isNaturalPlace(place)) return null;
  const { min, max } = VIEWPOINT_RADIUS;
  return { radius: clamp(place.altitude * RADIUS_PER_ALTITUDE, min, max), isPark: false };
}

/** Results with the same name this close together are one place (Apple lists some twice). */
const SAME_PLACE_METERS = 1000;

type Named = Coordinate & { id: string; name: string };

function sameName(a: string, b: string): boolean {
  return a.localeCompare(b, undefined, { sensitivity: 'base' }) === 0;
}

function isSamePlace(a: Named, b: Named): boolean {
  return (
    a.id === b.id || (sameName(a.name, b.name) && distanceKm(a, b) * 1000 <= SAME_PLACE_METERS)
  );
}

/** Scenic views come first; then everything else. */
function kindRank(category: PointOfInterestCategory): number {
  return category === 'scenicView' ? 0 : 1;
}

/**
 * A place's list: scenic views first, then the rest, each nearest first.
 * Apple can list a place twice (Lipan Point at the Grand Canyon) or under
 * two kinds (Mather Point is a scenic view and a visitor center); each
 * shows once, as its first kind. The place itself is left out: a scenic
 * view's own list doesn't offer it again.
 */
export function orderViewpoints(place: RecentCity, found: readonly PointOfInterest[]): Viewpoint[] {
  const center: Coordinate = { latitude: place.lat, longitude: place.lon };
  const self: Named = { id: place.id, name: place.name, ...center };
  const sorted = found
    .map((point) => ({ ...point, distance: distanceKm(center, point) * 1000 }))
    .sort(
      (a, b) =>
        kindRank(a.category) - kindRank(b.category) ||
        a.distance - b.distance ||
        a.name.localeCompare(b.name),
    );

  const kept: Viewpoint[] = [];
  for (const viewpoint of sorted) {
    if (isSamePlace(viewpoint, self) || kept.some((seen) => isSamePlace(seen, viewpoint))) continue;
    kept.push(viewpoint);
  }
  return kept;
}

/**
 * A viewpoint as a place to open, for `useShowCity()`: it joins Recent and
 * gets its own preview. The line under its name is the park it's in
 * ("Grand Canyon"), or else the line under the place it was listed for.
 */
export function viewpointPlace(viewpoint: Viewpoint, listedFor: RecentCity): RecentCity {
  const inPark = getCuratedCity(listedFor.id)?.category === 'park';
  return {
    id: viewpoint.id,
    name: viewpoint.name,
    country: inPark ? listedFor.name : listedFor.country,
    lat: viewpoint.latitude,
    lon: viewpoint.longitude,
    altitude:
      viewpoint.category === 'scenicView'
        ? VIEWPOINT_ALTITUDES.scenicView
        : VIEWPOINT_ALTITUDES.other,
  };
}
