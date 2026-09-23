import { Redirect, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { SEARCH_DEBOUNCE_MS, useCitySearch, useResolveCity } from '@/features/cities/queries';
import { colors, metrics, spacing, typeRamp } from '@/theme';
import { KIND_SYMBOLS } from '@/screens/CityPicker/searchSections';
import { useOpenSearchResult } from '@/screens/CityPicker/useOpenSearchResult';
import { InsetGroupedSection, ListRow, Screen, Text } from '@/ui';

type SearchParams = {
  q?: string;
  resolve?: string;
  open?: string;
};

/** Starts timing now; call the result to report the elapsed ms. Handlers and effects only. */
function startStopwatch(report: (ms: number) => void): () => void {
  const startedAt = Date.now();
  return () => report(Date.now() - startedAt);
}

/**
 * Dev-only place search check: diorama://dev/search?q=Par&resolve=1
 *
 * Type in the field (or pass `q`) to list Apple Maps suggestions in Apple's
 * order, each with its kind (city, address or place), and the time from
 * the last keystroke to the results. `q` searches at once; typing adds the
 * debounce. Tap a suggestion, or pass `resolve=1` to resolve the first one,
 * to see the resolved City (and its settled kind) as JSON.
 * `resolve=<completion id>` (e.g. `Tokyo%1FJapan`) resolves an id Swift
 * hasn't seen, through its text-search fallback. `open=1` opens the first
 * suggestion exactly as tapping it in the picker would (Recent, then the
 * preview): diorama://dev/search?q=1%20infinite%20loop&open=1
 */
export default function DevSearchRoute() {
  const params = useLocalSearchParams<SearchParams>();
  const [query, setQuery] = useState(params.q ?? '');
  const [typedAt, setTypedAt] = useState(() => Date.now());
  const [resolveMs, setResolveMs] = useState<number | null>(null);
  const search = useCitySearch(query);
  const {
    mutate: resolveCompletion,
    data: city,
    error: resolveError,
    isIdle: resolveIdle,
    isPending: resolving,
    variables: resolvingId,
  } = useResolveCity();

  const settled = search.isSuccess && !search.isPlaceholderData && !search.isFetching;
  const completions = search.data ?? [];
  const firstId = settled ? completions[0]?.id : undefined;
  // `resolve=1` picks the first suggestion; any other value is a completion id.
  const autoResolveId = params.resolve === '1' ? firstId : params.resolve;

  const startResolve = (completionId: string) => {
    setResolveMs(null);
    resolveCompletion(completionId, { onSuccess: startStopwatch(setResolveMs) });
  };

  // `resolve=…`: resolve once, as soon as there is something to resolve.
  useEffect(() => {
    if (!resolveIdle || !autoResolveId) return;
    resolveCompletion(autoResolveId, { onSuccess: startStopwatch(setResolveMs) });
  }, [resolveIdle, autoResolveId, resolveCompletion]);

  // `open=1`: open the first suggestion once, through the picker's own code.
  const { open: openInPicker } = useOpenSearchResult();
  const opened = useRef(false);
  const firstCompletion = settled ? completions[0] : undefined;
  useEffect(() => {
    if (params.open !== '1' || opened.current || !firstCompletion) return;
    opened.current = true;
    openInPicker(firstCompletion);
  }, [params.open, firstCompletion, openInPicker]);

  if (!__DEV__) return <Redirect href="/" />;

  // From the last keystroke to the results arriving from Swift. Negative
  // means the results were already cached before that keystroke.
  const elapsed = search.dataUpdatedAt - typedAt;
  let status = 'Type at least 2 letters.';
  if (search.isError) status = `Search failed: ${search.error.message}`;
  else if (settled) {
    const count = `${completions.length} ${completions.length === 1 ? 'result' : 'results'}`;
    status = elapsed >= 0 ? `${count} in ${elapsed} ms` : `${count} from cache`;
  } else if (query.trim().length > 1) status = 'Searching…';

  return (
    <Screen background="grouped">
      <Stack.Screen options={{ title: 'Place search' }} />
      <View style={styles.field}>
        <TextInput
          value={query}
          onChangeText={(text) => {
            setQuery(text);
            setTypedAt(Date.now());
          }}
          placeholder="City or address"
          placeholderTextColor={colors.placeholderText}
          autoFocus={params.q === undefined}
          autoCorrect={false}
          clearButtonMode="while-editing"
          returnKeyType="search"
          accessibilityLabel="City or address"
          style={styles.input}
        />
      </View>
      <Text variant="footnote" color="secondaryLabel" style={styles.status} testID="search-status">
        {status}
      </Text>

      {city || resolveError ? (
        <InsetGroupedSection
          title="Resolved city"
          footer={resolveMs === null ? undefined : `Resolved in ${resolveMs} ms`}
        >
          <Text variant="footnote" style={styles.json} selectable testID="resolved-city">
            {resolveError ? resolveError.message : JSON.stringify(city, null, 2)}
          </Text>
        </InsetGroupedSection>
      ) : null}

      {completions.length > 0 ? (
        <InsetGroupedSection
          title="Suggestions"
          footer={`Typing waits ${SEARCH_DEBOUNCE_MS} ms before searching. Tap a suggestion to resolve it.`}
        >
          {completions.map((completion) => (
            <ListRow
              key={completion.id}
              title={completion.title}
              subtitle={completion.subtitle}
              symbol={KIND_SYMBOLS[completion.kind]}
              value={resolving && resolvingId === completion.id ? 'Resolving…' : completion.kind}
              onPress={() => startResolve(completion.id)}
            />
          ))}
        </InsetGroupedSection>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  field: {
    marginTop: spacing.lg,
    marginHorizontal: metrics.screenMargin,
    paddingHorizontal: spacing.md,
    borderRadius: metrics.sectionRadius,
    borderCurve: 'continuous',
    backgroundColor: colors.secondarySystemGroupedBackground,
  },
  input: {
    // No lineHeight: it pushes single-line input text off center on iOS.
    fontSize: typeRamp.body.fontSize,
    minHeight: metrics.rowMinHeight,
    color: colors.label,
  },
  status: {
    marginTop: spacing.sm,
    marginHorizontal: metrics.screenMargin + spacing.lg,
  },
  json: {
    padding: spacing.lg,
    fontFamily: 'Menlo',
  },
});
