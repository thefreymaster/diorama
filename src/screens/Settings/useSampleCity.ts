import { CURATED_CITIES, getCuratedCity, type CuratedCity } from '@/features/cities/curated';
import { useRecents } from '@/features/cities/recentsStore';

/**
 * The city in the Settings preview: the one you opened last, if it's a
 * featured city (they have 3D buildings and a hand-framed camera), else the
 * first featured city. Searched cities may be flat, so they're skipped.
 */
export function useSampleCity(): CuratedCity {
  const recents = useRecents();

  for (const recent of recents) {
    const curated = getCuratedCity(recent.id);
    if (curated) return curated;
  }
  return CURATED_CITIES[0];
}
