import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { PlacePickerRegion } from '@diorama/native';
import { createPersistStorage } from '@/providers/storage';

/** Meters across a map spot: a few houses to half the Earth. Spans outside are clamped. */
export const SPOT_SPAN_RANGE = { min: 100, max: 20_000_000 } as const;

/** `meters` held within `SPOT_SPAN_RANGE`. */
export function clampSpan(meters: number): number {
  return Math.min(SPOT_SPAN_RANGE.max, Math.max(SPOT_SPAN_RANGE.min, meters));
}

type LastPickedSpotState = {
  /**
   * Where "Choose on map" last came to rest (the spot under the pin and
   * meters across), so the next opening starts there, as Apple Maps does.
   * `null` until the map has rested once.
   */
  spot: PlacePickerRegion | null;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * The spot as the map can show it: a real latitude and longitude and a
 * span above zero (clamped to `SPOT_SPAN_RANGE`), only those three fields.
 * Anything else is `null`.
 */
function cleanSpot(value: unknown): PlacePickerRegion | null {
  if (typeof value !== 'object' || value === null) return null;
  const { latitude, longitude, spanMeters } = value as Partial<
    Record<keyof PlacePickerRegion, unknown>
  >;
  if (!isFiniteNumber(latitude) || Math.abs(latitude) > 90) return null;
  if (!isFiniteNumber(longitude) || Math.abs(longitude) > 180) return null;
  if (!isFiniteNumber(spanMeters) || spanMeters <= 0) return null;
  return { latitude, longitude, spanMeters: clampSpan(spanMeters) };
}

/** Rebuilds the state from whatever was on disk. */
function sanitizePersisted(persisted: unknown): LastPickedSpotState {
  const saved = typeof persisted === 'object' && persisted !== null ? persisted : {};
  return { spot: cleanSpot((saved as { spot?: unknown }).spot) };
}

const useLastPickedSpotStore = create<LastPickedSpotState>()(
  persist((): LastPickedSpotState => ({ spot: null }), {
    name: 'lastPickedSpot',
    version: 1,
    storage: createPersistStorage<LastPickedSpotState>(),
    // Data saved under another version keeps a good spot instead of being dropped.
    migrate: sanitizePersisted,
    merge: (persisted, current) => ({ ...current, ...sanitizePersisted(persisted) }),
  }),
);

// Actions (callable from anywhere, no hook needed: nothing draws this, the
// picker only reads it once as it opens)

/** Where "Choose on map" last came to rest, or `null`. */
export function getLastPickedSpot(): PlacePickerRegion | null {
  return useLastPickedSpotStore.getState().spot;
}

/**
 * Remembers where the map came to rest. A spot the map couldn't show (a bad
 * coordinate or span) is ignored, keeping the one before.
 */
export function saveLastPickedSpot(region: PlacePickerRegion): void {
  const spot = cleanSpot(region);
  if (!spot) return;
  useLastPickedSpotStore.setState({ spot });
}

/** Forgets the spot: the next opening starts where you are, or Recent, or New York. */
export function clearLastPickedSpot(): void {
  useLastPickedSpotStore.setState({ spot: null });
}
