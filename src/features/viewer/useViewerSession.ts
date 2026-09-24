import { useRef, useState, type RefObject } from 'react';

import type { DioramaMapViewRef, DioramaReadyEvent } from '@diorama/native';
import { useSetting } from '@/features/settings/store';
import { actionHaptic, exitHaptic } from '@/ui';

import { useExitViewer } from './useExitViewer';
import { useHeadsetCountdown } from './useHeadsetCountdown';
import { useLookDrag } from './useLookDrag';
import { useOnChange } from './useOnChange';
import { usePinchZoom } from './usePinchZoom';
import { phaseWhenReady, useViewerPhase } from './useViewerPhase';
import { useViewerHud } from './useViewerHud';
import { useViewerMode, useViewerOrientation } from './useViewerMode';
import { useViewerTracking } from './useViewerTracking';

/**
 * One visit to the Viewer, from the black loading cover to the exit. How
 * the phone is held picks the view (`mode`, see `useViewerMode`):
 *
 * - Upright (and sideways with the two-eye view off), one full-screen
 *   picture held like a window: once the map draws (`onReady`) it
 *   recenters and follows the phone at once, and a one-finger drag
 *   (`lookDrag`) looks around too. Upright, a pinch (`pinchZoom`) moves
 *   you nearer to or farther from what's in the middle of the view; a
 *   recenter keeps that, and turning the phone sideways undoes it.
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
 * `lookDrag`, `pinchZoom`, `recenter` and `exit` to the gestures.
 */
export function useViewerSession(mapRef: RefObject<DioramaMapViewRef | null>) {
  const mode = useViewerMode();
  const orientation = useViewerOrientation();
  const inHeadset = mode === 'stereo';
  const debugLook = useSetting('debugLook');
  const { phase, setPhase } = useViewerPhase(mode);
  const [isDegraded, setDegraded] = useState(false);
  // The same, but set at once: the map can report `onReady` right behind
  // `onDegraded`, before React renders again.
  const degraded = useRef(false);
  const { hud, showCountdown, showNotice, hide } = useViewerHud();
  const pinchZoom = usePinchZoom(mapRef);
  const lookDrag = useLookDrag(mapRef, pinchZoom.isPinching);
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
    degraded.current = false;
    setDegraded(false);
    hide();
    if (phase === 'viewing') recenterMap();
  });

  const headTracking = useViewerTracking(phase === 'viewing', recenterMap);

  // Zooming is for the picture held upright, while it follows the phone.
  const canPinch = orientation === 'portrait' && headTracking;
  // A pinch cut short (the phone turned, the app left the screen) never
  // hears its fingers lift: let go of it here.
  useOnChange(canPinch, (can) => {
    if (!can) pinchZoom.release();
  });
  // Turned sideways, back to the place's normal distance.
  useOnChange(orientation, (turnedTo) => {
    if (turnedTo === 'landscape') pinchZoom.reset();
  });

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
    /** Held upright and following the phone, a pinch zooms. */
    pinchZoom: canPinch ? pinchZoom.handlers : null,
    onReady: (event: DioramaReadyEvent) => {
      // A report from the other view is stale (the one picture finished just
      // as the phone turned sideways): the eyes on screen still have to
      // draw. Too hot for two eyes, the map draws one picture on purpose.
      const drawing = degraded.current ? 'mono' : mode;
      if (event.mode !== drawing) return;
      const next = phaseWhenReady(phase, mode);
      if (next === phase) return;
      setPhase(next);
      if (next === 'viewing') recenterMap();
    },
    /** The phone got too hot and the view went mono on its own. Say so; don't undo it. */
    onDegraded: () => {
      degraded.current = true;
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
