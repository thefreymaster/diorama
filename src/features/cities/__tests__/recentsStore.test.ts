import { act, renderHook } from '@testing-library/react-native';

import {
  addRecent,
  clearRecents,
  removeRecent,
  useRecents,
  type RecentCity,
} from '../recentsStore';

type StoreModule = typeof import('../recentsStore');
type StorageModule = typeof import('@/providers/storage');

/** Fresh store and MMKV instance, like a cold app launch. */
function launch(saved?: string) {
  let store: StoreModule | undefined;
  let disk: StorageModule['storage'] | undefined;
  jest.isolateModules(() => {
    disk = jest.requireActual<StorageModule>('@/providers/storage').storage;
    if (saved !== undefined) disk.set('recents', saved);
    store = jest.requireActual<StoreModule>('../recentsStore');
  });
  if (!store || !disk) throw new Error('launch() failed to load the store');
  return { store, disk };
}

function city(id: string): RecentCity {
  return { id, name: id.toUpperCase(), country: 'Somewhere', lat: 10, lon: 20, altitude: 1200 };
}

describe('recents store', () => {
  it('starts empty', () => {
    const { store } = launch();

    expect(store.getRecents()).toEqual([]);
  });

  it('keeps the newest city first and each city once', () => {
    const { store } = launch();

    store.addRecent(city('paris'));
    store.addRecent(city('rome'));
    store.addRecent(city('paris'));

    expect(store.getRecents().map((c) => c.id)).toEqual(['paris', 'rome']);
  });

  it('keeps at most 8 cities', () => {
    const { store } = launch();

    for (let i = 0; i < 10; i++) store.addRecent(city(`city-${i}`));

    const ids = store.getRecents().map((c) => c.id);
    expect(ids).toHaveLength(store.MAX_RECENTS);
    expect(ids[0]).toBe('city-9');
    expect(ids).not.toContain('city-1');
  });

  it('moves a city up without dropping anything when the list is full', () => {
    const { store } = launch();
    for (let i = 0; i < store.MAX_RECENTS; i++) store.addRecent(city(`city-${i}`));

    store.addRecent(city('city-0'));

    const ids = store.getRecents().map((c) => c.id);
    expect(ids).toHaveLength(store.MAX_RECENTS);
    expect(ids[0]).toBe('city-0');
    expect(ids).toContain('city-1');
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps the newest details when a city is added again', () => {
    const { store } = launch();
    store.addRecent(city('paris'));

    store.addRecent({ ...city('paris'), name: 'Paris', altitude: 1500 });

    expect(store.getRecents()).toEqual([{ ...city('paris'), name: 'Paris', altitude: 1500 }]);
  });

  it('ignores removing a city that is not there', () => {
    const { store } = launch();
    store.addRecent(city('paris'));

    store.removeRecent('atlantis');

    expect(store.getRecents()).toEqual([city('paris')]);
  });

  it('stores only the fields a row and an offline lookup need', () => {
    const { store } = launch();
    const withExtras = { ...city('tokyo'), pitch: 60, heading: 30 };

    store.addRecent(withExtras);

    expect(store.getRecent('tokyo')).toEqual(city('tokyo'));
  });

  it('removes and clears cities', () => {
    const { store } = launch();
    store.addRecent(city('paris'));
    store.addRecent(city('rome'));

    store.removeRecent('paris');
    expect(store.getRecents().map((c) => c.id)).toEqual(['rome']);

    store.clearRecents();
    expect(store.getRecents()).toEqual([]);
  });

  it('rehydrates recents on the next launch', () => {
    const first = launch();
    first.store.addRecent(city('paris'));
    first.store.addRecent(city('rome'));

    const second = launch(first.disk.getString('recents'));

    expect(second.store.getRecents()).toEqual([city('rome'), city('paris')]);
  });

  it('remembers removals and clears on the next launch', () => {
    const first = launch();
    first.store.addRecent(city('paris'));
    first.store.addRecent(city('rome'));
    first.store.removeRecent('rome');

    const second = launch(first.disk.getString('recents'));
    expect(second.store.getRecents()).toEqual([city('paris')]);

    second.store.clearRecents();
    const third = launch(second.disk.getString('recents'));
    expect(third.store.getRecents()).toEqual([]);
  });

  it.each([
    ['not JSON', '{"state": {"cit'],
    ['a null state', JSON.stringify({ state: null, version: 1 })],
  ])('starts empty when the disk holds %s, and saves over it', (_label, saved) => {
    const { store, disk } = launch(saved);
    expect(store.getRecents()).toEqual([]);
    expect(store.getRecent('paris')).toBeUndefined();

    store.addRecent(city('paris'));

    expect(JSON.parse(disk.getString('recents') ?? 'null').state).toEqual({
      cities: [city('paris')],
    });
  });

  // Uses the app's own module instance: an isolated copy would bring its own React.
  it('re-renders useRecents consumers when the list changes', () => {
    const { result } = renderHook(() => useRecents());
    expect(result.current).toEqual([]);

    act(() => addRecent(city('paris')));
    expect(result.current.map((c) => c.id)).toEqual(['paris']);

    act(() => addRecent(city('rome')));
    act(() => removeRecent('paris'));
    expect(result.current.map((c) => c.id)).toEqual(['rome']);

    act(() => clearRecents());
    expect(result.current).toEqual([]);
  });
});

describe('recents store: malformed data on disk', () => {
  /** What zustand's persist middleware writes to MMKV. */
  function saved(state: unknown, version: unknown = 1): string {
    return JSON.stringify({ state, version });
  }

  it.each([
    ['a null list', saved({ cities: null })],
    ['a list that is an object', saved({ cities: { paris: city('paris') } })],
    ['a list that is a string', saved({ cities: 'paris,rome' })],
    ['a list that is a number', saved({ cities: 3 })],
    ['a state that is a string', saved('cities')],
    ['a state that is an array', saved([city('paris')])],
    ['a bare array', JSON.stringify([city('paris')])],
    ['a bare number', '42'],
    ['JSON null', 'null'],
  ])('treats %s as an empty list', (_label, data) => {
    const { store } = launch(data);

    expect(store.getRecents()).toEqual([]);
    // The crash T16 found: useCity -> getRecent on a null list.
    expect(store.getRecent('paris')).toBeUndefined();
  });

  it('keeps only well-formed entries, in order', () => {
    const { store } = launch(
      saved({
        cities: [
          city('first'),
          null,
          42,
          'paris',
          { ...city('no-name'), name: undefined },
          { ...city('empty-id'), id: '' },
          { ...city('blank-country'), country: '   ' },
          { ...city('numeric-name'), name: 7 },
          { ...city('lat-too-high'), lat: 90.5 },
          { ...city('lat-too-low'), lat: -91 },
          { ...city('lon-too-high'), lon: 181 },
          { ...city('lon-too-low'), lon: -180.5 },
          { ...city('lat-null'), lat: null },
          { ...city('lon-string'), lon: '20' },
          { ...city('altitude-string'), altitude: '1200' },
          { ...city('altitude-zero'), altitude: 0 },
          { ...city('altitude-negative'), altitude: -5 },
          { ...city('edge'), lat: -90, lon: 180 },
          city('last'),
        ],
      }),
    );

    expect(store.getRecents().map((c) => c.id)).toEqual(['first', 'edge', 'last']);
  });

  it('keeps the first (newest) copy of a repeated id', () => {
    const { store } = launch(
      saved({
        cities: [
          { ...city('paris'), name: 'Paris' },
          city('rome'),
          { ...city('paris'), name: 'Old Paris' },
        ],
      }),
    );

    expect(store.getRecents()).toEqual([{ ...city('paris'), name: 'Paris' }, city('rome')]);
  });

  it('keeps at most 8 cities, skipping bad entries before counting', () => {
    const entries = [null, ...Array.from({ length: 12 }, (_, i) => city(`city-${i}`))];

    const { store } = launch(saved({ cities: entries }));

    const ids = store.getRecents().map((c) => c.id);
    expect(ids).toHaveLength(store.MAX_RECENTS);
    expect(ids[0]).toBe('city-0');
    expect(ids[store.MAX_RECENTS - 1]).toBe(`city-${store.MAX_RECENTS - 1}`);
  });

  it('drops fields a recent city does not have', () => {
    const { store } = launch(saved({ cities: [{ ...city('tokyo'), pitch: 60, extra: { a: 1 } }] }));

    expect(store.getRecent('tokyo')).toEqual(city('tokyo'));
  });

  it('keeps the good entries from data saved under another version', () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { store } = launch(saved({ cities: [city('paris'), { id: 'broken' }] }, 0));

    expect(store.getRecents()).toEqual([city('paris')]);
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it('saves a clean list over malformed data', () => {
    const { store, disk } = launch(saved({ cities: [city('paris'), { id: 'broken' }] }));

    store.addRecent(city('rome'));

    expect(JSON.parse(disk.getString('recents') ?? 'null').state).toEqual({
      cities: [city('rome'), city('paris')],
    });
  });
});
