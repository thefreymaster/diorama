import { useLocalSearchParams } from 'expo-router';

import { useCity, type City } from '@/features/cities/queries';

/**
 * The city named by this route's `cityId`, or `null` when the app doesn't
 * know it. Local data only, so it's there on the first render.
 */
export function usePreviewCity(): City | null {
  const { cityId } = useLocalSearchParams<'/city/[cityId]'>();
  return useCity(cityId).data ?? null;
}
