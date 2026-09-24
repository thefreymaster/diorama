import { useRouter } from 'expo-router';

import { addRecent, type RecentCity } from '@/features/cities/recentsStore';

import { liveParams } from './liveMode';

/**
 * Opens the preview where you are, in live mode (`?live=1`): it, and the
 * Viewer after it, follow you as you move. The spot joins Recent like any
 * place you open; reopened from there, it's a fixed place.
 */
export function useShowHere() {
  const router = useRouter();

  return (place: RecentCity) => {
    addRecent(place);
    router.push({ pathname: '/city/[cityId]', params: { cityId: place.id, ...liveParams(true) } });
  };
}
