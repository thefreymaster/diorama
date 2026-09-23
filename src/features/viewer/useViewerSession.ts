import { useState, type RefObject } from 'react';

import type { DioramaMapViewRef } from '@diorama/native';
import { useSetting } from '@/features/settings/store';
import { actionHaptic, exitHaptic } from '@/ui';

import { useExitViewer } from './useExitViewer';
import { useHeadsetCountdown } from './useHeadsetCountdown';
import { useLookDrag } from './useLookDrag';
import { useOnChange } from './useOnChange';
import { phaseWhenReady, useViewerPhase } from './useViewerPhase';
import { useViewerHud } from './useViewerHud';
import { useViewerMode } from './useViewerMode';
import { useViewerTracking } from './useViewerTracking';

/**
 * One visit to the Viewer, from the black loading cover to the exit. How
 * the phone is held picks the view (`mode`, see `useViewerMode`):
 *
 * - Upright (and sideways with the two-eye view off), one full-screen
 *   picture held like a window: once the map draws (`onReady`) it
 *   recenters and follows the phone at once, and a one-finger drag
 *   (`lookDrag`) looks around too.
 * - Sideways, the headset: once both eyes draw, "Put on your viewer"
 *   counts 3, 2, 1, then it recenters and follows your head.
 *
 * Turning the phone switches live, from the same spot: into the headset
 * the fresh eyes load and it counts down again; out of it, it recenters
 * at once. Tracking pauses while the app is in the background, and
 * recenters when it comes back. Double-tap (`recenter`) re-centers with a
 * tap and a brief HUD; a long press (`exit`) goes back to the preview.
 *
 * `mapRef` is the screen's ref to the map. The screen hands `mode`,
 * `headTracking` and the callbacks to the map, `hud` to the HUD, and
 * `lookDrag`, `recenter` and `exit` to the gestures.
 */
export function useViewerSession(mapRef: RefObject<DioramaMapViewRef | null>) {
  const mode = useViewerMode();
  const inHeadset = mode === 'stereo';
  const debugLook = useSetting('debugLook');
  const { phase, setPhase } = useViewerPhase(mode);
  const [isDegraded, setDegraded] = useState(false);
  const { hud, showCountdown, showNotice, hide } = useViewerHud();
  const lookDrag = useLookDrag(mapRef);
  const exitViewer = useExitViewer();

  const recenterMap = () => {
    lookDrag.reset();
    void mapRef.current?.recenter();
  };

  useHeadsetCountdown(phase === 'counting', {
    onTick: showCountdown,
    onDone: () => {
      hide();
      recenterMap();
      setPhase('viewing');
    },
  });

  // The phone turned (or the setting changed): the phase has already
  // followed (`useViewerPhase`). Clear the HUD, which belonged to the other
  // view, and out of the headset, face wherever the phone faces now.
  useOnChange(mode, () => {
    // A new `mode` also lifts the native thermal fallback.
    setDegraded(false);
    hide();
    if (phase === 'viewing') recenterMap();
  });

  const headTracking = useViewerTracking(phase === 'viewing', recenterMap);

  return {
    mode,
    hud,
    /** In the headset each eye gets its own copy of the HUD. */
    hudPerEye: inHeadset && !isDegraded,
    headTracking,
    /**
     * Held in the hand and following the phone, a drag looks around. Off
     * with debug look, whose own drag stands in for the phone's motion.
     */
    lookDrag: !inHeadset && headTracking && !debugLook ? lookDrag.handlers : null,
    onReady: () => {
      const next = phaseWhenReady(phase, mode);
      if (next === phase) return;
      setPhase(next);
      if (next === 'viewing') recenterMap();
    },
    /** The phone got too hot and the view went mono on its own. Say so; don't undo it. */
    onDegraded: () => {
      setDegraded(true);
      showNotice('cooling');
    },
    /** Straight ahead is wherever the wearer faces now. Waits for the countdown. */
    recenter: () => {
      if (phase !== 'viewing') return;
      actionHaptic();
      recenterMap();
      showNotice('recentered');
    },
    exit: () => {
      exitHaptic();
      exitViewer();
    },
  };
}
