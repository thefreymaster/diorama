import { renderHook } from '@testing-library/react-native';
import type { SearchBarCommands } from 'react-native-screens';

import { useSearchFieldSync } from '../useSearchFieldSync';

function fakeSearchBar() {
  const bar: SearchBarCommands = {
    focus: jest.fn(),
    blur: jest.fn(),
    clearText: jest.fn(),
    toggleCancelButton: jest.fn(),
    setText: jest.fn(),
    cancelSearch: jest.fn(),
  };
  return { current: bar };
}

describe('useSearchFieldSync', () => {
  it('shows a query that a link changed while the picker is open', () => {
    const ref = fakeSearchBar();
    const { rerender } = renderHook(
      ({ query }: { query: string }) => useSearchFieldSync(ref, query),
      {
        initialProps: { query: 'par' },
      },
    );
    jest.mocked(ref.current.setText).mockClear();

    rerender({ query: 'rome' });
    expect(ref.current.setText).toHaveBeenLastCalledWith('rome');

    // A link with no query clears the field.
    rerender({ query: '' });
    expect(ref.current.setText).toHaveBeenLastCalledWith('');
  });

  it('never writes typed text back, even when the query lags behind the keys', () => {
    const ref = fakeSearchBar();
    const { result, rerender } = renderHook(
      ({ query }: { query: string }) => useSearchFieldSync(ref, query),
      {
        initialProps: { query: '' },
      },
    );
    jest.mocked(ref.current.setText).mockClear();

    result.current('p');
    result.current('pa');
    result.current('par');
    rerender({ query: 'pa' });
    rerender({ query: 'par' });
    result.current('');
    rerender({ query: '' });

    expect(ref.current.setText).not.toHaveBeenCalled();

    // A link after all that still gets through.
    rerender({ query: 'tokyo' });
    expect(ref.current.setText).toHaveBeenCalledWith('tokyo');
  });
});
