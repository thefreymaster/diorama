import { CURATED_CITIES } from '@/features/cities/curated';
import { hideFeatured, useHiddenFeatured } from '@/features/cities/hiddenFeaturedStore';
import { useRecents } from '@/features/cities/recentsStore';
import { InsetGroupedSection, SwipeToDeleteRow } from '@/ui';

import { PickerMessage } from './PickerMessage';
import { useOpenCity } from './useOpenCity';

/**
 * The hand-picked cities with photoreal 3D buildings. They're built in, so
 * deleting one only hides it here (Settings can restore them); it still
 * opens from search or a link.
 */
export function FeaturedSection() {
  const hidden = useHiddenFeatured();
  const hasRecents = useRecents().length > 0;
  const openCity = useOpenCity();
  const cities = CURATED_CITIES.filter((city) => !hidden.includes(city.id));

  if (cities.length === 0) {
    // With Recent empty too there'd be nothing under the search field at all.
    return hasRecents ? null : (
      <PickerMessage
        symbol="magnifyingglass"
        title="No places"
        body="Search for a city or place, or restore suggested places in Settings."
      />
    );
  }

  return (
    <InsetGroupedSection title="Featured" footer="Cities with 3D buildings in Apple Maps.">
      {cities.map((city) => (
        <SwipeToDeleteRow
          key={city.id}
          title={city.name}
          subtitle={city.country}
          symbol={city.symbol}
          symbolTile={city.tileColor}
          onPress={() => openCity(city)}
          onDelete={() => hideFeatured(city.id)}
        />
      ))}
    </InsetGroupedSection>
  );
}
