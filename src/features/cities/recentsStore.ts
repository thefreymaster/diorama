import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { createPersistStorage } from '@/providers/storage';

/** Enough to draw a row and to reopen the city offline. */
export type RecentCity = {
  id: string;
  name: string;
  country: string;
  lat: number;
  lon: number;
  /** Suggested camera altitude in meters. */
  altitude: number;
};

export const MAX_RECENTS = 8;

type RecentsState = {
  /** Newest first, unique by id, at most MAX_RECENTS. */
  cities: RecentCity[];
};

const useRecentsStore = create<RecentsState>()(
  persist((): RecentsState => ({ cities: [] }), {
    name: 'recents',
    version: 1,
    storage: createPersistStorage<RecentsState>(),
  }),
);

// Hooks

export function useRecents(): RecentCity[] {
  return useRecentsStore((state) => state.cities);
}

// Actions (callable from anywhere, no hook needed)

export function getRecents(): RecentCity[] {
  return useRecentsStore.getState().cities;
}

export function getRecent(id: string): RecentCity | undefined {
  return getRecents().find((city) => city.id === id);
}

/** Moves the city to the top of the list, dropping the oldest past MAX_RECENTS. */
export function addRecent({ id, name, country, lat, lon, altitude }: RecentCity): void {
  const entry: RecentCity = { id, name, country, lat, lon, altitude };
  useRecentsStore.setState((state) => ({
    cities: [entry, ...state.cities.filter((city) => city.id !== id)].slice(0, MAX_RECENTS),
  }));
}

export function removeRecent(id: string): void {
  useRecentsStore.setState((state) => ({
    cities: state.cities.filter((city) => city.id !== id),
  }));
}

export function clearRecents(): void {
  useRecentsStore.setState({ cities: [] });
}
