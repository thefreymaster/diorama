import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';

import { useCity, type City } from '@/features/cities/queries';

/**
 * The city named by this route's `cityId`. For a link to a city the app
 * doesn't know, there's nothing to show while worn, so it quietly goes back
 * to the city list and returns `null` meanwhile.
 */
export function useViewerCity(): City | null {
  const router = useRouter();
  const { cityId } = useLocalSearchParams<'/view/[cityId]'>();
  const city = useCity(cityId).data ?? null;
  const isUnknown = city === null;

  useEffect(() => {
    if (isUnknown) router.dismissTo('/');
  }, [isUnknown, router]);

  return city;
}
