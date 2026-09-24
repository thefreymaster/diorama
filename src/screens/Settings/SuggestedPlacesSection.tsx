import { InsetGroupedSection, ListRow } from '@/ui';

import { useRestoreSuggestedPlaces } from './useRestoreSuggestedPlaces';

/** Brings back the featured cities deleted from the picker. Shown only while there are some. */
export function SuggestedPlacesSection() {
  const { canRestore, restore } = useRestoreSuggestedPlaces();

  if (!canRestore) return null;

  return (
    <InsetGroupedSection footer="Puts the featured cities you deleted back in the list.">
      <ListRow title="Restore suggested places" tinted chevron={false} onPress={restore} />
    </InsetGroupedSection>
  );
}
