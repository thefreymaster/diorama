import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { useState, type RefObject } from 'react';
import { AccessibilityInfo, Linking } from 'react-native';

import {
  distanceKm,
  type Coordinate,
  type PlacePickerMapViewRef,
  type PlacePickerRegion,
} from '@diorama/native';
import { readLocationAccess } from '@/features/location/locateMe';
import { locationKeys, useLocationAccess } from '@/features/location/useLocationAccess';
import { LOCATE_SUBTITLES } from '@/features/location/useLocateMe';
import { selectionHaptic } from '@/ui';

import {
  NEARBY_SPAN_M,
  START_LOCATE_TIMEOUT_MS,
  whereYouAre,
  type PickerStart,
} from './pickerStart';
import { withTimeout } from './withTimeout';

/** The pin is on you while the map's middle is within this many meters of your last fix. */
export const ON_YOU_RADIUS_M = 20;

/** How a tap's look for you ended. */
type FindYouResult =
  | { kind: 'found'; fix: Coordinate }
  /** Location access is off for Diorama, or Location Services is: only Settings can help. */
  | { kind: 'accessOff' }
  /** Asked just now, and the answer was "Don't Allow". */
  | { kind: 'declined' }
  /** No fix within `START_LOCATE_TIMEOUT_MS`. */
  | { kind: 'noFix' };

/**
 * Looks for you after a tap on "Show my location". Asks for location access
 * if it was never asked (a tap is the intent; the sheet never asks on its
 * own) and calls `onAnswered` once the prompt is answered. Then takes a fix
 * as the picker's start does (`whereYouAre`), giving up after
 * `START_LOCATE_TIMEOUT_MS`.
 */
async function findYou(onAnswered: () => void): Promise<FindYouResult> {
  // Core Location answers this at once; if it's stuck, nothing is found.
  const access = await withTimeout(readLocationAccess(), START_LOCATE_TIMEOUT_MS).catch(() => null);
  if (access === null) return { kind: 'noFix' };
  if (access === 'denied' || access === 'servicesOff') return { kind: 'accessOff' };
  if (access === 'undetermined') {
    // The prompt: no time limit, it waits for an answer.
    const { granted } = await Location.requestForegroundPermissionsAsync();
    onAnswered();
    if (!granted) return { kind: 'declined' };
  }
  const fix = await withTimeout(whereYouAre(), START_LOCATE_TIMEOUT_MS).catch(() => null);
  return fix ? { kind: 'found', fix } : { kind: 'noFix' };
}

/** Tells VoiceOver, which stays on the button and wouldn't hear the map not moving. */
function announceNoFix() {
  AccessibilityInfo.announceForAccessibility(LOCATE_SUBTITLES.unavailable);
}

/**
 * "Show my location" on the picker map, like Apple Maps' location button.
 * `locate()` glides the map to where you are (`mapRef`'s `moveTo`), keeping
 * the zoom if it already shows a neighborhood or less, else zooming to one
 * (`NEARBY_SPAN_M`). The first tap asks for location access; with access
 * off, it opens Diorama's page in Settings, as the "Current location" row
 * does. Taps while it looks are ignored. With no fix in time nothing moves.
 *
 * Feed it each rest of the map (`onRegionChangeEnd`): `onYou` is true while
 * the pin is on you, for the filled icon.
 */
export function useZoomToMe(mapRef: RefObject<PlacePickerMapViewRef | null>, start: PickerStart) {
  const queryClient = useQueryClient();
  const access = useLocationAccess();
  // Where the map is, or is gliding to: its start until it first rests.
  const [shown, setShown] = useState<PlacePickerRegion>(() => ({
    ...start.center,
    spanMeters: start.span,
  }));
  // Where the button last found you.
  const [fix, setFix] = useState<Coordinate | null>(null);

  const mutation = useMutation({
    // Once answered, read the access again, so Apple's blue dot appears.
    mutationFn: () =>
      findYou(() => void queryClient.invalidateQueries({ queryKey: locationKeys.access })),
    networkMode: 'always',
  });

  const accessOff = access === 'denied' || access === 'servicesOff';
  const onYou = fix !== null && distanceKm(shown, fix) * 1000 <= ON_YOU_RADIUS_M;

  const moveToYou = (here: Coordinate) => {
    // A closer zoom stays; from farther out, a neighborhood.
    const spanMeters = Math.min(shown.spanMeters, NEARBY_SPAN_M);
    setFix(here);
    // Filled at once, as in Maps; the rest at the end of the glide confirms it.
    setShown({ ...here, spanMeters });
    void mapRef.current?.moveTo(here, spanMeters);
  };

  const locate = () => {
    if (mutation.isPending) return;
    if (accessOff) {
      void Linking.openSettings();
      return;
    }
    selectionHaptic();
    // These run only while the sheet is up: closed meanwhile, nothing happens.
    mutation.mutate(undefined, {
      onSuccess: (result) => {
        if (result.kind === 'found') moveToYou(result.fix);
        else if (result.kind === 'accessOff') void Linking.openSettings();
        else if (result.kind === 'noFix') announceNoFix();
      },
      onError: announceNoFix,
    });
  };

  const onRegionChangeEnd = (region: PlacePickerRegion) => setShown(region);

  return { onYou, accessOff, locate, onRegionChangeEnd };
}
