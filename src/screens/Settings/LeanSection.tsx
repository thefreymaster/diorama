import { setHeadPosition, useSetting } from '@/features/settings/store';
import { InsetGroupedSection, ListRow, ToggleRow } from '@/ui';

import { useLeanCameraAccess } from './useLeanCameraAccess';

export const LEAN_TITLE = 'Lean to move closer';
export const LEAN_FOOTER =
  'Lean in to get closer to the city, like leaning over a model. Uses the camera; nothing is recorded.';
export const CAMERA_OFF = 'Camera access is off';

/**
 * Lean to move closer: leaning in brings you nearer the city. It needs the
 * camera, so while access is off a row under the switch says so, and a tap
 * on it opens Diorama's page in iOS Settings, like "Current location" in the
 * picker.
 */
export function LeanSection() {
  const leanOn = useSetting('headPosition');
  const camera = useLeanCameraAccess();

  return (
    <InsetGroupedSection footer={LEAN_FOOTER}>
      <ToggleRow
        title={LEAN_TITLE}
        testID="lean-switch"
        value={leanOn}
        onValueChange={setHeadPosition}
      />
      {camera.isOff ? (
        <ListRow
          title={CAMERA_OFF}
          onPress={camera.openSettings}
          accessibilityHint="Opens Settings."
        />
      ) : null}
    </InsetGroupedSection>
  );
}
