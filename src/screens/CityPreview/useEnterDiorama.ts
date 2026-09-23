import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

/** "Enter Diorama": a light tap, then the full-screen Viewer for this city. */
export function useEnterDiorama(cityId: string) {
  const router = useRouter();

  return () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: '/view/[cityId]', params: { cityId } });
  };
}
