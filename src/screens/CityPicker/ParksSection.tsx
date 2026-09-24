import { CURATED_PARKS } from '@/features/cities/curated';
import { hideFeatured, useHiddenFeatured } from '@/features/cities/hiddenFeaturedStore';
import { InsetGroupedSection, SwipeToDeleteRow } from '@/ui';

import { useOpenCity } from './useOpenCity';

/**
 * US national parks, below Featured: Apple's 3D terrain with no buildings.
 * They're built in like the featured cities and share their hidden list, so
 * deleting one only hides it here and "Restore suggested places" in Settings
 * brings it back. Hidden once every park is deleted.
 */
export function ParksSection() {
  const hidden = useHiddenFeatured();
  const openCity = useOpenCity();
  const parks = CURATED_PARKS.filter((park) => !hidden.includes(park.id));

  if (parks.length === 0) return null;

  return (
    <InsetGroupedSection title="National parks" footer="Landscapes with 3D terrain in Apple Maps.">
      {parks.map((park) => (
        <SwipeToDeleteRow
          key={park.id}
          title={park.name}
          subtitle={park.country}
          symbol={park.symbol}
          symbolTile={park.tileColor}
          onPress={() => openCity(park)}
          onDelete={() => hideFeatured(park.id)}
        />
      ))}
    </InsetGroupedSection>
  );
}
