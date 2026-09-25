import { CURATED_CITIES, getCuratedCity, type CuratedCity } from '@/features/cities/curated';

/**
 * Settings' own view of Boston (Featured Boston keeps its view). Featured
 * Boston centers on Downtown Crossing, which in this small card gives up to
 * half the picture to the Common. This centers by the Old State House, between
 * the Financial District's towers and Government Center (City Hall Plaza and
 * the curve of Center Plaza), so skyline fills the card all the way round the
 * orbit. 1,200 m at 60°: any farther and MapKit flattens the view. It opens
 * looking south-west, the towers on the left and Government Center on the
 * right, which is also the still picture under Reduce Motion.
 */
const DOWNTOWN_BOSTON = {
  lat: 42.358,
  lon: -71.0575,
  altitude: 1200,
  pitch: 60,
  heading: 225,
} as const satisfies Pick<CuratedCity, 'lat' | 'lon' | 'altitude' | 'pitch' | 'heading'>;

/**
 * Featured Boston is looked up by id, not taken from the Featured list, so
 * it's still here after you delete Boston from the picker. The first featured
 * city, with its own view, only stands in if the entry is ever removed (the
 * Settings tests would fail).
 */
const BOSTON = getCuratedCity('boston');
const SAMPLE_CITY: CuratedCity = BOSTON ? { ...BOSTON, ...DOWNTOWN_BOSTON } : CURATED_CITIES[0];

/**
 * The city in the Settings preview: always downtown Boston, whatever you
 * opened last or deleted from the picker. One familiar skyline makes each
 * slider move easy to judge, and it has 3D buildings, which a national park
 * or a searched place may not.
 */
export function useSampleCity(): CuratedCity {
  return SAMPLE_CITY;
}
