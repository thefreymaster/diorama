import { useState } from 'react';

import type { DioramaReadyEvent } from '@diorama/native';

/**
 * What the preview map has told us. It belongs to this one screen, so it
 * lives here rather than in a store: the screen hands `onReady` to the map
 * and the results to the card.
 */
export function usePreviewMapStatus() {
  const [ready, setReady] = useState<DioramaReadyEvent | null>(null);

  return {
    /** The map has drawn its first full frame. */
    isReady: ready !== null,
    /**
     * Only once the map has drawn, and only where the place was checked and
     * found flat. Where nobody has checked (`unknown`) Apple may well have 3D,
     * so we say nothing rather than risk a wrong "terrain only".
     */
    showTerrainNote: ready?.coverage === 'no',
    onReady: setReady,
  };
}
