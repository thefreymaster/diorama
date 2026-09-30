import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';

import type { PlacePickerRegion } from '@diorama/native';

import { startFromParams } from './pickerStart';

/**
 * Opens the spot a link names as if "Open Mini City" were tapped, when the
 * link asks for it with `open=1`
 * (`diorama://pick?lat=28.4187&lon=-81.5812&span=3000&open=1`): Apple Maps
 * names it, it joins Recent and its preview opens, the same path as a tap.
 * The Simulator can't tap from a script, so this is how
 * scripts/screenshots.sh opens a place that isn't in the app's lists. Only
 * with a linked `lat` and `lon`, and once per link.
 */
export function useOpenLinkedSpot(open: (spot: PlacePickerRegion) => void) {
  const params = useLocalSearchParams<{
    lat?: string;
    lon?: string;
    span?: string;
    open?: string;
  }>();
  // The link's own spot, not the map's: the sheet's map may still rest where
  // an earlier link left it.
  const linked = params.open === '1' ? startFromParams(params) : null;
  const latitude = linked?.center.latitude;
  const longitude = linked?.center.longitude;
  const spanMeters = linked?.span;
  const opened = useRef<string | null>(null);

  useEffect(() => {
    if (latitude === undefined || longitude === undefined || spanMeters === undefined) return;
    const key = `${latitude},${longitude},${spanMeters}`;
    if (opened.current === key) return;
    opened.current = key;
    open({ latitude, longitude, spanMeters });
  }, [latitude, longitude, spanMeters, open]);
}
