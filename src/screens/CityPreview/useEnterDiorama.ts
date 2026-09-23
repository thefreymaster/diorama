import { useRouter } from 'expo-router';

import { actionHaptic } from '@/ui';

/** "Enter Diorama": a light tap, then the full-screen Viewer for this city. */
export function useEnterDiorama(cityId: string) {
  const router = useRouter();

  return () => {
    actionHaptic();
    router.push({ pathname: '/view/[cityId]', params: { cityId } });
  };
}
