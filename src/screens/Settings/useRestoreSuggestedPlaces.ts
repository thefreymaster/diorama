import { AccessibilityInfo } from 'react-native';

import { restoreFeatured, useHiddenFeatured } from '@/features/cities/hiddenFeaturedStore';
import { actionHaptic } from '@/ui';

/**
 * "Restore suggested places": brings back every featured city deleted from
 * the picker, with a light tap. Only offered while something is hidden.
 */
export function useRestoreSuggestedPlaces() {
  const hasHidden = useHiddenFeatured().length > 0;

  return {
    canRestore: hasHidden,
    restore: () => {
      actionHaptic();
      restoreFeatured();
      // The row disappears as it's used, so say that it worked.
      AccessibilityInfo.announceForAccessibility('Suggested places restored');
    },
  };
}
