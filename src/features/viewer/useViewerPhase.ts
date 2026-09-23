import { useState } from 'react';

import type { DioramaViewMode } from '@diorama/native';

/**
 * Where a visit to the Viewer is:
 * - `loading`: the map is drawing behind its black cover;
 * - `counting`: "Put on your viewer" 3, 2, 1 (the headset only);
 * - `viewing`: in the city, following the phone's motion.
 */
export type ViewerPhase = 'loading' | 'counting' | 'viewing';

/**
 * The phase once the map has drawn: the headset counts down first, so
 * there's time to put it on; held in the hand, you're straight in. Only the
 * first report after a load counts; a later one changes nothing.
 */
export function phaseWhenReady(phase: ViewerPhase, mode: DioramaViewMode): ViewerPhase {
  if (phase !== 'loading') return phase;
  return mode === 'stereo' ? 'counting' : 'viewing';
}

/**
 * The phase after the view switches mode mid-visit (the phone turned).
 * Into the headset, fresh eyes load (the map sends `onReady` again), and
 * then it counts down again. Out of it, you're straight in, unless the map
 * is still drawing: then its `onReady` takes it from there.
 */
export function phaseAfterSwitch(phase: ViewerPhase, mode: DioramaViewMode): ViewerPhase {
  if (mode === 'stereo') return 'loading';
  return phase === 'loading' ? 'loading' : 'viewing';
}

type Visit = { mode: DioramaViewMode; phase: ViewerPhase };

/**
 * The visit's phase for `mode`. When `mode` changes, the new phase is
 * worked out in that same render (React's "adjusting state when a prop
 * changes"), so it goes out to the map together with the new mode, and a
 * countdown the switch interrupts stops at once.
 */
export function useViewerPhase(mode: DioramaViewMode) {
  const [visit, setVisit] = useState<Visit>({ mode, phase: 'loading' });
  let { phase } = visit;
  if (visit.mode !== mode) {
    phase = phaseAfterSwitch(visit.phase, mode);
    setVisit({ mode, phase });
  }

  return {
    phase,
    setPhase: (next: ViewerPhase) => setVisit((current) => ({ ...current, phase: next })),
  };
}
