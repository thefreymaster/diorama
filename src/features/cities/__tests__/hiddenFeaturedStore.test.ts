import { act, renderHook } from '@testing-library/react-native';

import { hideFeatured, restoreFeatured, useHiddenFeatured } from '../hiddenFeaturedStore';

type StoreModule = typeof import('../hiddenFeaturedStore');
type StorageModule = typeof import('@/providers/storage');

/** Fresh store and MMKV instance, like a cold app launch. */
function launch(saved?: string) {
  let store: StoreModule | undefined;
  let disk: StorageModule['storage'] | undefined;
  jest.isolateModules(() => {
    disk = jest.requireActual<StorageModule>('@/providers/storage').storage;
    if (saved !== undefined) disk.set('hiddenFeatured', saved);
    store = jest.requireActual<StoreModule>('../hiddenFeaturedStore');
  });
  if (!store || !disk) throw new Error('launch() failed to load the store');
  return { store, disk };
}

/** What zustand's persist middleware writes to MMKV. */
function saved(state: unknown, version: unknown = 1): string {
  return JSON.stringify({ state, version });
}

function savedIds(disk: StorageModule['storage']): unknown {
  return JSON.parse(disk.getString('hiddenFeatured') ?? 'null').state.ids;
}

describe('hidden featured cities', () => {
  it('starts with none hidden', () => {
    const { store } = launch();

    expect(store.getHiddenFeatured()).toEqual([]);
  });

  it('hides featured cities, each once, in the order they were deleted', () => {
    const { store } = launch();

    store.hideFeatured('paris');
    store.hideFeatured('tokyo');
    store.hideFeatured('paris');

    expect(store.getHiddenFeatured()).toEqual(['paris', 'tokyo']);
  });

  it('ignores ids that are not featured cities', () => {
    const { store } = launch();

    store.hideFeatured('hoboken_40.744_-74.032');
    store.hideFeatured('');

    expect(store.getHiddenFeatured()).toEqual([]);
  });

  it('restores them all at once', () => {
    const { store } = launch();
    store.hideFeatured('paris');
    store.hideFeatured('rome');

    store.restoreFeatured();

    expect(store.getHiddenFeatured()).toEqual([]);
  });

  it('remembers hidden cities on the next launch, and the restore too', () => {
    const first = launch();
    first.store.hideFeatured('paris');
    first.store.hideFeatured('london');

    const second = launch(first.disk.getString('hiddenFeatured'));
    expect(second.store.getHiddenFeatured()).toEqual(['paris', 'london']);

    second.store.restoreFeatured();
    const third = launch(second.disk.getString('hiddenFeatured'));
    expect(third.store.getHiddenFeatured()).toEqual([]);
  });

  // Uses the app's own module instance: an isolated copy would bring its own React.
  it('re-renders useHiddenFeatured consumers when the list changes', () => {
    const { result } = renderHook(() => useHiddenFeatured());
    expect(result.current).toEqual([]);

    act(() => hideFeatured('sydney'));
    expect(result.current).toEqual(['sydney']);

    act(() => restoreFeatured());
    expect(result.current).toEqual([]);
  });
});

describe('hidden featured cities: malformed data on disk', () => {
  it.each([
    ['not JSON', '{"state": {"ids'],
    ['a null state', saved(null)],
    ['a null list', saved({ ids: null })],
    ['a list that is a string', saved({ ids: 'paris' })],
    ['a list that is an object', saved({ ids: { paris: true } })],
    ['a state that is an array', saved(['paris'])],
    ['a bare array', JSON.stringify(['paris'])],
    ['JSON null', 'null'],
  ])('treats %s as nothing hidden, and saves over it', (_label, data) => {
    const { store, disk } = launch(data);
    expect(store.getHiddenFeatured()).toEqual([]);

    store.hideFeatured('rome');

    expect(savedIds(disk)).toEqual(['rome']);
  });

  it('keeps only featured city ids, first copy of each, in order', () => {
    const { store } = launch(
      saved({
        ids: [
          'tokyo',
          42,
          null,
          'atlantis',
          '',
          { id: 'paris' },
          'paris',
          'tokyo',
          'dubai',
          'rome',
        ],
      }),
    );

    expect(store.getHiddenFeatured()).toEqual(['tokyo', 'paris', 'rome']);
  });

  it('keeps the good ids from data saved under another version', () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { store } = launch(saved({ ids: ['paris', 7] }, 0));

    expect(store.getHiddenFeatured()).toEqual(['paris']);
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });
});
