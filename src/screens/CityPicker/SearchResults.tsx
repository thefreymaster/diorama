import { isSearchSuperseded } from '@diorama/native';

import { useCitySearch } from '@/features/cities/queries';
import { InsetGroupedSection, ListRow, SkeletonRow } from '@/ui';

import { PickerMessage } from './PickerMessage';
import { useOpenSearchResult } from './useOpenSearchResult';
import { usePickerQuery } from './usePickerQuery';

/** Rows to hold the place of results that haven't arrived yet. */
const SKELETON_ROWS = 3;

/**
 * Apple Maps suggestions for the search text, with the matched letters in
 * bold. Shows skeleton rows until the first results arrive; after that, the
 * last results stay put while the next ones load.
 */
export function SearchResults() {
  const { query } = usePickerQuery();
  const search = useCitySearch(query);
  const { open, failedId } = useOpenSearchResult();
  const completions = search.data;

  if (!completions) {
    // A newer search replacing this one isn't a failure: its results are coming.
    if (search.isError && !isSearchSuperseded(search.error)) {
      return (
        <PickerMessage
          symbol="wifi.slash"
          title="Can't search right now"
          body="Check your connection and try again."
        />
      );
    }
    return (
      <InsetGroupedSection>
        {Array.from({ length: SKELETON_ROWS }, (_, index) => (
          <SkeletonRow key={index} />
        ))}
      </InsetGroupedSection>
    );
  }

  if (completions.length === 0) {
    return (
      <PickerMessage
        symbol="magnifyingglass"
        title="No results"
        body="Check the spelling or try a new search."
      />
    );
  }

  const failed = completions.find((completion) => completion.id === failedId);

  return (
    <InsetGroupedSection footer={failed ? `Couldn't open ${failed.title}. Try again.` : undefined}>
      {completions.map((completion) => (
        <ListRow
          key={completion.id}
          title={completion.title}
          titleHighlights={completion.titleHighlights}
          subtitle={completion.subtitle}
          symbol="mappin.and.ellipse"
          onPress={() => open(completion)}
        />
      ))}
    </InsetGroupedSection>
  );
}
