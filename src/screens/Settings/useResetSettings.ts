import { resetSettings } from '@/features/settings/store';
import { actionHaptic } from '@/ui';

/**
 * "Reset to defaults": a light tap, then every setting goes back at once.
 * There's nothing to lose but a few slider positions, so it doesn't ask.
 */
export function useResetSettings() {
  return () => {
    actionHaptic();
    resetSettings();
  };
}
