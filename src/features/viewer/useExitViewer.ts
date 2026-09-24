import { useLocalSearchParams, useRouter } from 'expo-router';

import { liveParams, useLiveMode } from '@/features/location/liveMode';

/**
 * Back to this city's preview. It pops to the preview when it's underneath,
 * or takes the Viewer's place when the Viewer was opened straight from a
 * link (so it never drops a landscape modal straight onto the picker). A
 * live Viewer goes back to a live preview (the params it pops to replace
 * the preview's own).
 */
export function useExitViewer() {
  const router = useRouter();
  const { cityId } = useLocalSearchParams<'/view/[cityId]'>();
  const live = useLiveMode();

  return () =>
    router.dismissTo({ pathname: '/city/[cityId]', params: { cityId, ...liveParams(live) } });
}
