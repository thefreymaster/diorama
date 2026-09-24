import { View } from 'react-native';

import { Screen } from '@/ui';

import { CurrentLocationSection } from './CurrentLocationSection';
import { FeaturedSection } from './FeaturedSection';
import { ParksSection } from './ParksSection';
import { PickerHeader } from './PickerHeader';
import { RecentSection } from './RecentSection';
import { SearchResults } from './SearchResults';
import { usePickerQuery } from './usePickerQuery';

/**
 * Home: "Diorama" in a large title with a search field. With nothing typed
 * it offers your current location, then Recent, Featured cities and
 * National parks; while typing, Apple Maps results for cities, addresses
 * and places. Any row opens that place's preview.
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
            <CurrentLocationSection />
            <RecentSection />
            <FeaturedSection />
            <ParksSection />
          </>
        )}
      </View>
    </Screen>
  );
}
