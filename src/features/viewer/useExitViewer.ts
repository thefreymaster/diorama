import { useLocalSearchParams, useRouter } from 'expo-router';

/**
 * Back to this city's preview. It pops to the preview when it's underneath,
 * or takes the Viewer's place when the Viewer was opened straight from a
 * link (so it never drops a landscape modal straight onto the picker).
 */
export function useExitViewer() {
  const router = useRouter();
  const { cityId } = useLocalSearchParams<'/view/[cityId]'>();

  return () => router.dismissTo({ pathname: '/city/[cityId]', params: { cityId } });
}
