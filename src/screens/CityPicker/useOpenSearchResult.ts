import { useNavigation } from 'expo-router';
import { AccessibilityInfo } from 'react-native';

import type { Completion } from '@diorama/native';

import { useResolveCity } from '@/features/cities/queries';
import { selectionHaptic } from '@/ui';

import { curatedMatch } from './curatedMatch';
import { useShowCity } from './useOpenCity';

/** What the results footer says (and VoiceOver hears) when a suggestion won't open. */
export function openFailedMessage(title: string): string {
  return `Couldn't open ${title}. Try again.`;
}

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
    selectionHaptic();
    resolve.mutate(completion.id, {
      onSuccess: (city) => {
        // The user may have moved on (say, to Settings) while it resolved.
        if (!navigation.isFocused()) return;
        showCity(curatedMatch(city) ?? city);
      },
      // The footer appears far from the row that was tapped, so say it too.
      onError: () =>
        AccessibilityInfo.announceForAccessibility(openFailedMessage(completion.title)),
    });
  };

  return {
    open,
    /** The suggestion that failed to open, to say so quietly. */
    failedId: resolve.isError ? resolve.variables : undefined,
  };
}
