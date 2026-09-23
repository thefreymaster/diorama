import { createMMKV } from 'react-native-mmkv';
import { createJSONStorage, type StateStorage } from 'zustand/middleware';

/**
 * The app's single on-disk key/value store. MMKV reads synchronously, so
 * persisted zustand stores are hydrated before the first render.
 * Under Jest, MMKV swaps itself for an in-memory map.
 */
export const storage = createMMKV({ id: 'diorama' });

const mmkvStateStorage: StateStorage = {
  getItem: (name) => storage.getString(name) ?? null,
  setItem: (name, value) => storage.set(name, value),
  removeItem: (name) => {
    storage.remove(name);
  },
};

/** JSON storage for zustand's `persist` middleware, backed by MMKV. */
export function createPersistStorage<S>() {
  return createJSONStorage<S>(() => mmkvStateStorage);
}
