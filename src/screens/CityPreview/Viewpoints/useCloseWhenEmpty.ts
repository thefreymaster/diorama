import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';

/**
 * Closes the sheet when it has nothing to list (a link to a place Apple
 * Maps has no viewpoints for, an unknown place, or iOS before 27), so it
 * never shows up empty. The preview's button only appears with a list.
 * It waits for the sheet to be on screen: a link can land here before the
 * stack is ready to go back.
 */
export function useCloseWhenEmpty(isEmpty: boolean) {
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      if (isEmpty && router.canGoBack()) router.back();
    }, [isEmpty, router]),
  );
}
