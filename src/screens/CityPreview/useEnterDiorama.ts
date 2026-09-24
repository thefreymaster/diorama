import { useRouter } from 'expo-router';

import { liveParams, useLiveMode } from '@/features/location/liveMode';
import { actionHaptic } from '@/ui';

/**
 * "Enter Diorama": a light tap, then the full-screen Viewer for this city,
 * still following you if this preview is (live mode).
 */
export function useEnterDiorama(cityId: string) {
  const router = useRouter();
  const live = useLiveMode();

  return () => {
    actionHaptic();
    router.push({ pathname: '/view/[cityId]', params: { cityId, ...liveParams(live) } });
  };
}
