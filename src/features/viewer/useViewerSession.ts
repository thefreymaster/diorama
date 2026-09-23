import * as Haptics from 'expo-haptics';
import { useState, type RefObject } from 'react';

import type { DioramaMapViewRef } from '@diorama/native';
import { useSetting } from '@/features/settings/store';

import { useExitViewer } from './useExitViewer';
import { useStartupCountdown } from './useStartupCountdown';
import { useViewerHud } from './useViewerHud';
import { useViewerTracking } from './useViewerTracking';

/**
 * One visit to the Viewer, from the black loading cover to the exit:
 *
 * 1. The map draws (`onReady`), then "Put on your viewer" counts 3, 2, 1.
 * 2. It recenters and head tracking starts. Tracking pauses while the app
 *    is in the background, and recenters when it comes back.
 * 3. Double-tap (`recenter`) re-centers with a tap and a brief HUD; a long
 *    press (`exit`) goes back to the preview.
 *
 * `mapRef` is the screen's ref to the map. The screen hands `headTracking`
 * and the callbacks to the map, `hud` to the HUD, and `recenter`/`exit` to
 * the gestures.
 */
export function useViewerSession(mapRef: RefObject<DioramaMapViewRef | null>) {
  const mode = useSetting('mode');
  const [isDegraded, setDegraded] = useState(false);
  const { hud, showCountdown, showNotice, hide } = useViewerHud();
  const exitViewer = useExitViewer();

  const recenterMap = () => {
    void mapRef.current?.recenter();
  };

  const countdown = useStartupCountdown({
    onTick: showCountdown,
    onDone: () => {
      hide();
      recenterMap();
    },
  });

  const headTracking = useViewerTracking(countdown.isDone, recenterMap);

  return {
    hud,
    /** In stereo each eye gets its own copy of the HUD, so it reads in a headset. */
    hudPerEye: mode === 'stereo' && !isDegraded,
    headTracking,
    onReady: countdown.start,
    /** The phone got too hot and the view went mono on its own. Say so; don't undo it. */
    onDegraded: () => {
      setDegraded(true);
      showNotice('cooling');
    },
    /** Straight ahead is wherever the wearer faces now. Waits for the countdown. */
    recenter: () => {
      if (!countdown.isDone) return;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      recenterMap();
      showNotice('recentered');
    },
    exit: () => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      exitViewer();
    },
  };
}
