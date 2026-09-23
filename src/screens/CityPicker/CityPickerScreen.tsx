import { View } from 'react-native';

import { Screen } from '@/ui';

import { FeaturedSection } from './FeaturedSection';
import { PickerHeader } from './PickerHeader';
import { RecentSection } from './RecentSection';
import { SearchResults } from './SearchResults';
import { usePickerQuery } from './usePickerQuery';

/**
 * Home: "Diorama" in a large title with a search field. With nothing typed
 * it lists Recent and Featured cities; while typing, Apple Maps results.
 * Any row opens that city's preview.
 */
export function CityPickerScreen() {
  const { isSearching } = usePickerQuery();

  return (
    <Screen background="grouped">
      <PickerHeader />
      <View testID="city-picker-screen">
        {isSearching ? (
          <SearchResults />
        ) : (
          <>
            <RecentSection />
            <FeaturedSection />
          </>
        )}
      </View>
    </Screen>
  );
}
