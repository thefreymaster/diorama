import { useNavigation } from 'expo-router';

import type { Completion } from '@diorama/native';

import { useResolveCity } from '@/features/cities/queries';

import { curatedMatch } from './curatedMatch';
import { playSelectionHaptic, useShowCity } from './useOpenCity';

/**
 * Opens a search suggestion. A suggestion is only a name, so it's resolved
 * into a city first (coordinates, altitude), then shown like any other.
 * A suggestion that is a featured city opens the featured one.
 */
export function useOpenSearchResult() {
  const navigation = useNavigation();
  const showCity = useShowCity();
  const resolve = useResolveCity();

  const open = (completion: Completion) => {
    // One at a time: a second tap while resolving would open two previews.
    if (resolve.isPending) return;
    playSelectionHaptic();
    resolve.mutate(completion.id, {
      onSuccess: (city) => {
        // The user may have moved on (say, to Settings) while it resolved.
        if (!navigation.isFocused()) return;
        showCity(curatedMatch(city) ?? city);
      },
    });
  };

  return {
    open,
    /** The suggestion that failed to open, to say so quietly. */
    failedId: resolve.isError ? resolve.variables : undefined,
  };
}
