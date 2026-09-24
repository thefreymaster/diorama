import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { createPersistStorage } from '@/providers/storage';

import { getCuratedCity } from './curated';

type HiddenFeaturedState = {
  /**
   * Featured cities deleted from the picker's list, oldest first, each once.
   * They're built in, so "deleting" one only hides it: it still opens from
   * search, a link, Recent, or the Settings preview.
   */
  ids: string[];
};

/**
 * Rebuilds the list from whatever was on disk: ids of featured cities that
 * still exist, first copy of each. Anything else is [].
 */
function sanitizePersisted(persisted: unknown): HiddenFeaturedState {
  const saved = typeof persisted === 'object' && persisted !== null ? persisted : {};
  const ids = (saved as { ids?: unknown }).ids;
  if (!Array.isArray(ids)) return { ids: [] };

  const clean: string[] = [];
  for (const id of ids) {
    // A city dropped from the featured list in an update is forgotten too.
    if (typeof id !== 'string' || !getCuratedCity(id) || clean.includes(id)) continue;
    clean.push(id);
  }
  return { ids: clean };
}

const useHiddenFeaturedStore = create<HiddenFeaturedState>()(
  persist((): HiddenFeaturedState => ({ ids: [] }), {
    name: 'hiddenFeatured',
    version: 1,
    storage: createPersistStorage<HiddenFeaturedState>(),
    // Data saved under another version keeps its good entries instead of being dropped.
    migrate: sanitizePersisted,
    merge: (persisted, current) => ({ ...current, ...sanitizePersisted(persisted) }),
  }),
);

// Hooks

/** Ids of the featured cities the picker leaves out. */
export function useHiddenFeatured(): string[] {
  return useHiddenFeaturedStore((state) => state.ids);
}

// Actions (callable from anywhere, no hook needed)

export function getHiddenFeatured(): string[] {
  return useHiddenFeaturedStore.getState().ids;
}

/** Leaves a featured city out of the picker's list. Ids that aren't featured are ignored. */
export function hideFeatured(id: string): void {
  if (!getCuratedCity(id)) return;
  useHiddenFeaturedStore.setState((state) =>
    state.ids.includes(id) ? state : { ids: [...state.ids, id] },
  );
}

/** Brings every hidden featured city back. */
export function restoreFeatured(): void {
  useHiddenFeaturedStore.setState({ ids: [] });
}
