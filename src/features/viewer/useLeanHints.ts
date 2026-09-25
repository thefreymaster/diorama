import { useEffect, useEffectEvent, useState } from 'react';

import type { DioramaHeadPositionState, DioramaHeadPositionStateEvent } from '@diorama/native';

import type { HudNotice } from './hud';

/** How long the camera may lose its place (`limited`) before the HUD asks you to hold still. */
export const LIMITED_HINT_DELAY_MS = 3000;

type LeanHintHandlers = {
  showNotice: (notice: HudNotice) => void;
  /** Lets a notice go once it has been read, if it's still up. */
  endNotice: (notice: HudNotice) => void;
};

/**
 * Brief HUD hints for lean to move closer, from the map's
 * `onHeadPositionState`: "Look around the room to start" while the camera
 * gets its bearings, and "Hold still, finding your place" once it has been
 * lost for a few seconds. Each fades once tracking is back (after a moment
 * to read it), or after its hold time if it never is. Returns the handler
 * for the map's event.
 */
export function useLeanHints({ showNotice, endNotice }: LeanHintHandlers) {
  const [state, setState] = useState<DioramaHeadPositionState>('off');
  const show = useEffectEvent(showNotice);
  const end = useEffectEvent(endNotice);

  useEffect(() => {
    if (state === 'starting') {
      show('leanStarting');
      return () => end('leanStarting');
    }
    if (state !== 'limited') return;
    const timer = setTimeout(() => show('leanLimited'), LIMITED_HINT_DELAY_MS);
    return () => {
      clearTimeout(timer);
      end('leanLimited');
    };
  }, [state]);

  return (event: DioramaHeadPositionStateEvent) => setState(event.state);
}
