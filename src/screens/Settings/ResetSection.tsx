import { InsetGroupedSection, ListRow } from '@/ui';

import { useResetSettings } from './useResetSettings';

/** A red "Reset to defaults" row, like the reset rows in Settings. */
export function ResetSection() {
  const reset = useResetSettings();

  return (
    <InsetGroupedSection>
      <ListRow
        title="Reset to defaults"
        destructive
        chevron={false}
        onPress={reset}
        accessibilityHint="Puts every setting back the way it started, the map style too."
      />
    </InsetGroupedSection>
  );
}
