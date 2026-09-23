import type { RecentCity } from '../recentsStore';

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
});
