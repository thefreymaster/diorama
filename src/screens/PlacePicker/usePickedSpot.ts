import { useState } from 'react';

import type { PlacePickerRegion } from '@diorama/native';

import type { PickerStart } from './pickerStart';

function sameRegion(a: PlacePickerRegion, b: PlacePickerRegion): boolean {
  return a.latitude === b.latitude && a.longitude === b.longitude && a.spanMeters === b.spanMeters;
}

/**
 * The spot under the pin: where the map last came to rest, or its start
 * until it first reports. It belongs to this one screen, so it lives here
 * rather than in a store: the map writes it, the card reads it.
 */
export function usePickedSpot(start: PickerStart | undefined) {
  const [rested, setRested] = useState<PlacePickerRegion | null>(null);
  const spot: PlacePickerRegion | null =
    rested ?? (start ? { ...start.center, spanMeters: start.span } : null);

  const onRegionChangeEnd = (region: PlacePickerRegion) =>
    setRested((previous) => (previous && sameRegion(previous, region) ? previous : region));

  return { spot, onRegionChangeEnd };
}
