import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';

import { findStart, startFromParams, type PickerStart } from './pickerStart';

/**
 * Where the picker map opens: the spot a link names (`?lat=…&lon=…&span=…`),
 * else where you are, the newest Recent place or New York (`findStart`).
 * `undefined` for the moment it takes to look. Worked out once per opening:
 * the map never jumps after it appears.
 */
export function usePickerStart(): PickerStart | undefined {
  const params = useLocalSearchParams<{ lat?: string; lon?: string; span?: string }>();
  const linked = startFromParams(params);
  const found = useQuery({
    queryKey: ['location', 'pickerStart'],
    queryFn: findStart,
    enabled: linked === null,
    // Once per opening: kept while the sheet is up, forgotten when it closes.
    staleTime: Infinity,
    gcTime: 0,
    networkMode: 'always',
    retry: false,
  });
  return linked ?? found.data;
}
