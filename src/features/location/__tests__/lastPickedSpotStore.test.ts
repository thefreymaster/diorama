import type { PlacePickerRegion } from '@diorama/native';

import { SPOT_SPAN_RANGE } from '../lastPickedSpotStore';

type StoreModule = typeof import('../lastPickedSpotStore');
type StorageModule = typeof import('@/providers/storage');

const KEY = 'lastPickedSpot';

const EIFFEL: PlacePickerRegion = { latitude: 48.8584, longitude: 2.2945, spanMeters: 2000 };
const BURJ: PlacePickerRegion = { latitude: 25.1972, longitude: 55.2744, spanMeters: 24_000 };

/** Fresh store and MMKV instance, like a cold app launch. */
function launch(saved?: string) {
  let store: StoreModule | undefined;
  let disk: StorageModule['storage'] | undefined;
  jest.isolateModules(() => {
    disk = jest.requireActual<StorageModule>('@/providers/storage').storage;
    if (saved !== undefined) disk.set(KEY, saved);
    store = jest.requireActual<StoreModule>('../lastPickedSpotStore');
  });
  if (!store || !disk) throw new Error('launch() failed to load the store');
  return { store, disk };
}

/** What zustand's persist middleware writes to MMKV. */
function saved(state: unknown, version: unknown = 1): string {
  return JSON.stringify({ state, version });
}

function savedSpot(disk: StorageModule['storage']): unknown {
  return JSON.parse(disk.getString(KEY) ?? 'null').state.spot;
}

describe('last picked spot', () => {
  it('starts with nothing saved', () => {
    const { store } = launch();

    expect(store.getLastPickedSpot()).toBeNull();
  });

  it('keeps the latest spot the map rested on', () => {
    const { store, disk } = launch();

    store.saveLastPickedSpot(EIFFEL);
    store.saveLastPickedSpot(BURJ);

    expect(store.getLastPickedSpot()).toEqual(BURJ);
    expect(savedSpot(disk)).toEqual(BURJ);
  });

  it('keeps only the spot itself, a copy of what the map reported', () => {
    const { store } = launch();
    const region = { ...EIFFEL, heading: 90 };

    store.saveLastPickedSpot(region);
    region.latitude = 0;

    expect(store.getLastPickedSpot()).toEqual(EIFFEL);
  });

  it('clamps the span to a few houses up to half the Earth', () => {
    const { store } = launch();

    store.saveLastPickedSpot({ ...EIFFEL, spanMeters: 3 });
    expect(store.getLastPickedSpot()?.spanMeters).toBe(SPOT_SPAN_RANGE.min);

    store.saveLastPickedSpot({ ...EIFFEL, spanMeters: 90_000_000 });
    expect(store.getLastPickedSpot()?.spanMeters).toBe(SPOT_SPAN_RANGE.max);
  });

  it.each<[string, PlacePickerRegion]>([
    ['a latitude past the pole', { ...BURJ, latitude: 91 }],
    ['a longitude past the date line', { ...BURJ, longitude: -180.5 }],
    ['a coordinate that is not a number', { ...BURJ, longitude: Number.NaN }],
    ['no span', { ...BURJ, spanMeters: 0 }],
    ['an endless span', { ...BURJ, spanMeters: Number.POSITIVE_INFINITY }],
  ])('ignores a spot with %s, keeping the one before', (_label, region) => {
    const { store, disk } = launch();
    store.saveLastPickedSpot(EIFFEL);

    store.saveLastPickedSpot(region);

    expect(store.getLastPickedSpot()).toEqual(EIFFEL);
    expect(savedSpot(disk)).toEqual(EIFFEL);
  });

  it('remembers the spot on the next launch, and forgetting it too', () => {
    const first = launch();
    first.store.saveLastPickedSpot(BURJ);

    const second = launch(first.disk.getString(KEY));
    expect(second.store.getLastPickedSpot()).toEqual(BURJ);

    second.store.clearLastPickedSpot();
    const third = launch(second.disk.getString(KEY));
    expect(third.store.getLastPickedSpot()).toBeNull();
  });
});

describe('last picked spot: malformed data on disk', () => {
  it.each([
    ['not JSON', '{"state": {"spot'],
    ['JSON null', 'null'],
    ['a bare spot', JSON.stringify(EIFFEL)],
    ['a null state', saved(null)],
    ['a state that is an array', saved([EIFFEL])],
    ['a spot that is a string', saved({ spot: '48.8584,2.2945' })],
    ['a spot that is an array', saved({ spot: [48.8584, 2.2945, 2000] })],
    ['a latitude past the pole', saved({ spot: { ...EIFFEL, latitude: -90.01 } })],
    ['a longitude past the date line', saved({ spot: { ...EIFFEL, longitude: 181 } })],
    ['a latitude written as text', saved({ spot: { ...EIFFEL, latitude: '48.8584' } })],
    ['no longitude', saved({ spot: { latitude: 48.8584, spanMeters: 2000 } })],
    ['no span', saved({ spot: { latitude: 48.8584, longitude: 2.2945 } })],
    ['a span of zero', saved({ spot: { ...EIFFEL, spanMeters: 0 } })],
    ['a span below zero', saved({ spot: { ...EIFFEL, spanMeters: -2000 } })],
    ['a span written as text', saved({ spot: { ...EIFFEL, spanMeters: '2000' } })],
  ])('treats %s as nothing saved, and saves over it', (_label, data) => {
    const { store, disk } = launch(data);
    expect(store.getLastPickedSpot()).toBeNull();

    store.saveLastPickedSpot(BURJ);

    expect(savedSpot(disk)).toEqual(BURJ);
  });

  it('clamps a saved span and drops fields it doesn’t know', () => {
    const tooClose = launch(saved({ spot: { ...EIFFEL, spanMeters: 12, pitch: 60 } }));
    expect(tooClose.store.getLastPickedSpot()).toEqual({
      ...EIFFEL,
      spanMeters: SPOT_SPAN_RANGE.min,
    });

    const tooFar = launch(saved({ spot: { ...EIFFEL, spanMeters: 1e12 } }));
    expect(tooFar.store.getLastPickedSpot()).toEqual({
      ...EIFFEL,
      spanMeters: SPOT_SPAN_RANGE.max,
    });
  });

  it('keeps a good spot saved under another version', () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { store } = launch(saved({ spot: BURJ }, 0));

    expect(store.getLastPickedSpot()).toEqual(BURJ);
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });
});
