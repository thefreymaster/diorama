import { Linking } from 'react-native';

import { useSetting } from '@/features/settings/store';
import { useCameraAccess } from '@/features/viewer/useCameraAccess';

/**
 * Whether to say camera access is off under "Lean to move closer": only
 * while the switch is on (off, the camera isn't used). Read without asking,
 * never the prompt (the Viewer asks), on mount and on each return to the
 * app, so it clears once access is turned on in iOS Settings.
 * `openSettings` opens Diorama's page there.
 */
export function useLeanCameraAccess() {
  const leanOn = useSetting('headPosition');
  const access = useCameraAccess(leanOn);

  return {
    isOff: leanOn && access === 'denied',
    openSettings: () => void Linking.openSettings(),
  };
}
