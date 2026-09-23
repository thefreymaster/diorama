import { useLocalSearchParams, useRouter } from 'expo-router';

/** The fewest characters worth searching for (`useCitySearch` needs 2). */
export const MIN_SEARCH_LENGTH = 2;

/**
 * The picker's search text. It lives in the route as `?q=`, so no component
 * passes it down, and a link such as diorama://?q=par opens the picker
 * already searching.
 */
export function usePickerQuery() {
  const { q = '' } = useLocalSearchParams<{ q?: string }>();
  const router = useRouter();

  return {
    query: q,
    /** Enough text to show search results instead of Recent and Featured. */
    isSearching: q.trim().length >= MIN_SEARCH_LENGTH,
    setQuery: (text: string) => router.setParams({ q: text === '' ? undefined : text }),
  };
}
