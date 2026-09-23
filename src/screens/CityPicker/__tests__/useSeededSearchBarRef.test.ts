import { renderHook } from '@testing-library/react-native';
import type { SearchBarCommands } from 'react-native-screens';

import { useSeededSearchBarRef } from '../useSeededSearchBarRef';

function fakeSearchBar(): SearchBarCommands {
  return {
    focus: jest.fn(),
    blur: jest.fn(),
    clearText: jest.fn(),
    toggleCancelButton: jest.fn(),
    setText: jest.fn(),
    cancelSearch: jest.fn(),
  };
}

describe('useSeededSearchBarRef', () => {
  it('types the text once, as soon as the native bar attaches', () => {
    const { result } = renderHook(() => useSeededSearchBarRef('par'));
    const bar = fakeSearchBar();
    expect(result.current.current).toBeNull();

    // What React does when the header's search bar mounts, re-renders, then unmounts.
    result.current.current = bar;
    result.current.current = null;
    result.current.current = bar;

    expect(result.current.current).toBe(bar);
    expect(bar.setText).toHaveBeenCalledTimes(1);
    expect(bar.setText).toHaveBeenCalledWith('par');
  });

  it('leaves the field alone when there is nothing to type', () => {
    const { result } = renderHook(() => useSeededSearchBarRef(''));
    const bar = fakeSearchBar();

    result.current.current = bar;

    expect(bar.setText).not.toHaveBeenCalled();
  });
});
