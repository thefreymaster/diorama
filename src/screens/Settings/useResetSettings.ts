import * as Haptics from 'expo-haptics';

import { resetSettings } from '@/features/settings/store';

/**
 * "Reset to defaults": a light tap, then every setting goes back at once.
 * There's nothing to lose but a few slider positions, so it doesn't ask.
 */
export function useResetSettings() {
  return () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    resetSettings();
  };
}
