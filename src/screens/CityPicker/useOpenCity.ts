import { useRouter } from 'expo-router';

import { addRecent, type RecentCity } from '@/features/cities/recentsStore';
import { selectionHaptic } from '@/ui';

/**
 * Shows a city's preview. Every city you open becomes the newest recent,
 * featured ones included, so it's one tap away next time and the preview
 * can find it offline.
 */
export function useShowCity() {
  const router = useRouter();

  return (city: RecentCity) => {
    addRecent(city);
    router.push({ pathname: '/city/[cityId]', params: { cityId: city.id } });
  };
}

/** For rows that already hold a city (Recent, Featured): tick, then show it. */
export function useOpenCity() {
  const showCity = useShowCity();

  return (city: RecentCity) => {
    selectionHaptic();
    showCity(city);
  };
}
