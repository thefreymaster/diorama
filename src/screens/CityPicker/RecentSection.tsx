import { removeRecent, useRecents } from '@/features/cities/recentsStore';
import { InsetGroupedSection, SwipeToDeleteRow } from '@/ui';

import { useOpenCity } from './useOpenCity';

/** The cities opened last, newest first. Hidden until there is one. Swipe a row to delete it. */
export function RecentSection() {
  const recents = useRecents();
  const openCity = useOpenCity();

  if (recents.length === 0) return null;

  return (
    <InsetGroupedSection title="Recent">
      {recents.map((city) => (
        <SwipeToDeleteRow
          key={city.id}
          title={city.name}
          subtitle={city.country}
          symbol="clock.fill"
          onPress={() => openCity(city)}
          onDelete={() => removeRecent(city.id)}
        />
      ))}
    </InsetGroupedSection>
  );
}
