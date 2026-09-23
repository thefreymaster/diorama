import { setDebugLook, useSetting } from '@/features/settings/store';
import { InsetGroupedSection } from '@/ui';

import { ToggleRow } from './ToggleRow';

/**
 * Dev builds only: drag to look around in the Simulator, which has no
 * motion sensors. Release builds never show it (or use it).
 */
export function DeveloperSection() {
  const debugLook = useSetting('debugLook');

  if (!__DEV__) return null;

  return (
    <InsetGroupedSection
      title="Developer"
      footer="Drag the view to look around instead of turning your head. For the Simulator, which has no motion sensors."
    >
      <ToggleRow
        title="Look around by dragging"
        testID="debug-look-switch"
        value={debugLook}
        onValueChange={setDebugLook}
      />
    </InsetGroupedSection>
  );
}
