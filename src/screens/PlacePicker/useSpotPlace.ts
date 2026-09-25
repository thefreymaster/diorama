import { useQuery } from '@tanstack/react-query';

import type { PlacePickerRegion } from '@diorama/native';
import type { RecentCity } from '@/features/cities/recentsStore';

import { pickedPlace } from './pickedPlace';
import { NAME_DEBOUNCE_MS, spotNameKey, spotNameQuery } from './spotName';
import { useDebouncedValue } from './useDebouncedValue';

/**
 * The spot under the pin as a named place, for the card. Its name is looked
 * up once the map has rested for a moment (a spot named before shows its
 * name at once); until then, and where Apple Maps has none, it's the
 * spot's coordinates. Only the current spot's answer is ever shown.
 */
export function useSpotPlace(spot: PlacePickerRegion): RecentCity {
  // Compared as text, so a new object for the same spot doesn't restart the wait.
  const key = spotNameKey(spot).join();
  const settledKey = useDebouncedValue(key, NAME_DEBOUNCE_MS);
  const address = useQuery({ ...spotNameQuery(spot), enabled: settledKey === key });
  return pickedPlace(spot, address.data);
}
