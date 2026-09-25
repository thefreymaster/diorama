import { useEffect, useEffectEvent, useState } from 'react';

import type { DioramaCompassState, DioramaCompassStateEvent } from '@diorama/native';

import type { HudNotice } from './hud';

/**
 * How long the compass may be calibrating before the HUD asks for a figure 8,
 * so a compass that settles at once (as it usually does) never shows it.
 */
export const CALIBRATING_HINT_DELAY_MS = 1500;

type CompassHintHandlers = {
  showNotice: (notice: HudNotice) => void;
  /** Lets a notice go once it has been read, if it's still up. */
  endNotice: (notice: HudNotice) => void;
};

/**
 * Live mode's brief HUD hint, from the map's `onCompassState`: "Move your
 * iPhone in a figure 8 to calibrate" once the compass has been calibrating
 * for a moment. It fades once the compass is good (after a moment to read
 * it), when true north gives up quietly (`unavailable`), or after its hold
 * time. Returns the handler for the map's event.
 */
export function useCompassHint({ showNotice, endNotice }: CompassHintHandlers) {
  const [state, setState] = useState<DioramaCompassState>('unavailable');
  const show = useEffectEvent(showNotice);
  const end = useEffectEvent(endNotice);

  useEffect(() => {
    if (state !== 'calibrating') return;
    const timer = setTimeout(() => show('compassCalibrating'), CALIBRATING_HINT_DELAY_MS);
    return () => {
      clearTimeout(timer);
      end('compassCalibrating');
    };
  }, [state]);

  return (event: DioramaCompassStateEvent) => setState(event.state);
}
