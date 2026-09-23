import { useRecents } from '@/features/cities/recentsStore';
import { InsetGroupedSection, ListRow } from '@/ui';

import { useOpenCity } from './useOpenCity';

/** The cities opened last, newest first. Hidden until there is one. */
export function RecentSection() {
  const recents = useRecents();
  const openCity = useOpenCity();

  if (recents.length === 0) return null;

  return (
    <InsetGroupedSection title="Recent">
      {recents.map((city) => (
        <ListRow
          key={city.id}
          title={city.name}
          subtitle={city.country}
          symbol="clock.fill"
          onPress={() => openCity(city)}
        />
      ))}
    </InsetGroupedSection>
  );
}
