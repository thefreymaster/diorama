import { Stack, useRouter } from 'expo-router';

import { usePickerQuery } from './usePickerQuery';
import { useSearchFieldSync } from './useSearchFieldSync';
import { useSeededSearchBarRef } from './useSeededSearchBarRef';

/**
 * The picker's part of the native navigation bar: the search field under
 * the large title and a Settings gear on the right. Both are real UIKit
 * controls (UISearchController, UIBarButtonItem). Renders nothing itself.
 */
export function PickerHeader() {
  const router = useRouter();
  const { query, setQuery } = usePickerQuery();
  const searchBarRef = useSeededSearchBarRef(query);
  const noteTyped = useSearchFieldSync(searchBarRef, query);

  return (
    <>
      <Stack.SearchBar
        ref={searchBarRef}
        placeholder="Search for a city"
        autoCapitalize="words"
        // Searching is what this screen is for: keep the field in reach.
        hideWhenScrolling={false}
        // Results show in this screen's list, so it must stay visible and tappable.
        obscureBackground={false}
        onChangeText={({ nativeEvent: { text } }) => {
          noteTyped(text);
          setQuery(text);
        }}
        // Results update as you type, so the Search key just puts the keyboard away.
        onSearchButtonPress={() => searchBarRef.current?.blur()}
      />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon="gearshape"
          accessibilityLabel="Settings"
          onPress={() => router.push('/settings')}
        />
      </Stack.Toolbar>
    </>
  );
}
