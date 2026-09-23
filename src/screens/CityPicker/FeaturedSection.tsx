import { CURATED_CITIES } from '@/features/cities/curated';
import { InsetGroupedSection, ListRow } from '@/ui';

import { useOpenCity } from './useOpenCity';

/** The hand-picked cities with photoreal 3D buildings. */
export function FeaturedSection() {
  const openCity = useOpenCity();

  return (
    <InsetGroupedSection title="Featured" footer="Cities with 3D buildings in Apple Maps.">
      {CURATED_CITIES.map((city) => (
        <ListRow
          key={city.id}
          title={city.name}
          subtitle={city.country}
          symbol={city.symbol}
          symbolTile={city.tileColor}
          onPress={() => openCity(city)}
        />
      ))}
    </InsetGroupedSection>
  );
}
