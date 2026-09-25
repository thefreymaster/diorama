import { useRouter } from 'expo-router';
import { useRef } from 'react';

import type { RecentCity } from '@/features/cities/recentsStore';
import { viewpointPlace, type Viewpoint } from '@/features/viewpoints/viewpoints';
import { useShowCity } from '@/screens/CityPicker/useOpenCity';
import { selectionHaptic } from '@/ui';

/**
 * Opens a viewpoint as a place: the sheet closes, the viewpoint joins
 * Recent and its preview opens on top of the one the list was for. Only
 * the first tap counts; the sheet is already on its way out.
 */
export function useOpenViewpoint(listedFor: RecentCity | null) {
  const router = useRouter();
  const showCity = useShowCity();
  const opened = useRef(false);

  return (viewpoint: Viewpoint) => {
    if (!listedFor || opened.current) return;
    opened.current = true;
    selectionHaptic();
    router.back();
    showCity(viewpointPlace(viewpoint, listedFor));
  };
}
