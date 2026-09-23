import { createPersistStorage, storage } from '../storage';

type Probe = { count: number };

describe('createPersistStorage', () => {
  afterEach(() => {
    storage.remove('probe');
  });

  it('writes JSON to MMKV and reads it back synchronously', () => {
    const persistStorage = createPersistStorage<Probe>();
    if (!persistStorage) throw new Error('createPersistStorage returned no storage');

    persistStorage.setItem('probe', { state: { count: 2 }, version: 1 });
    const read = persistStorage.getItem('probe');

    // A Promise here would mean stores hydrate after the first render.
    expect(read).not.toBeInstanceOf(Promise);
    expect(read).toEqual({ state: { count: 2 }, version: 1 });
    expect(JSON.parse(storage.getString('probe') ?? 'null')).toEqual({
      state: { count: 2 },
      version: 1,
    });
  });

  it('reads a missing key as null and removes keys', () => {
    const persistStorage = createPersistStorage<Probe>();
    if (!persistStorage) throw new Error('createPersistStorage returned no storage');
    expect(persistStorage.getItem('probe')).toBeNull();

    persistStorage.setItem('probe', { state: { count: 1 }, version: 1 });
    persistStorage.removeItem('probe');

    expect(storage.getString('probe')).toBeUndefined();
    expect(persistStorage.getItem('probe')).toBeNull();
  });
});
