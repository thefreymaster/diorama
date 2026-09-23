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

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** True when a value read from disk can safely be drawn and reopened. */
function isRecentCity(value: unknown): value is RecentCity {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Partial<Record<keyof RecentCity, unknown>>;
  return (
    isNonEmptyString(entry.id) &&
    isNonEmptyString(entry.name) &&
    isNonEmptyString(entry.country) &&
    isFiniteNumber(entry.lat) &&
    Math.abs(entry.lat) <= 90 &&
    isFiniteNumber(entry.lon) &&
    Math.abs(entry.lon) <= 180 &&
    // A camera altitude in meters: zero or below can't be rendered.
    isFiniteNumber(entry.altitude) &&
    entry.altitude > 0
  );
}

/**
 * Rebuilds the list from whatever was on disk: well-formed entries only,
 * first (newest) copy of each id, at most MAX_RECENTS. Anything else is [].
 */
function sanitizePersisted(persisted: unknown): RecentsState {
  const saved = typeof persisted === 'object' && persisted !== null ? persisted : {};
  const cities = (saved as { cities?: unknown }).cities;
  if (!Array.isArray(cities)) return { cities: [] };

  const seen = new Set<string>();
  const clean: RecentCity[] = [];
  for (const entry of cities) {
    if (clean.length === MAX_RECENTS) break;
    if (!isRecentCity(entry) || seen.has(entry.id)) continue;
    seen.add(entry.id);
    const { id, name, country, lat, lon, altitude } = entry;
    clean.push({ id, name, country, lat, lon, altitude });
  }
  return { cities: clean };
}

const useRecentsStore = create<RecentsState>()(
  persist((): RecentsState => ({ cities: [] }), {
    name: 'recents',
    version: 1,
    storage: createPersistStorage<RecentsState>(),
    // Data saved under another version keeps its good entries instead of being dropped.
    migrate: sanitizePersisted,
    merge: (persisted, current) => ({ ...current, ...sanitizePersisted(persisted) }),
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
