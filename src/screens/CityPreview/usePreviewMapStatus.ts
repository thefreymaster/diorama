import { useState } from 'react';

import type { DioramaReadyEvent } from '@diorama/native';
import { useSetting } from '@/features/settings/store';

/**
 * What the preview map has told us. It belongs to this one screen, so it
 * lives here rather than in a store: the screen hands `onReady` to the map
 * and the results to the card.
 */
export function usePreviewMapStatus() {
  const [ready, setReady] = useState<DioramaReadyEvent | null>(null);
  const mapStyle = useSetting('mapStyle');

  return {
    /** The map has drawn its first full frame. */
    isReady: ready !== null,
    /**
     * Only once the map has drawn, and only where the place was checked and
     * found flat. Where nobody has checked (`unknown`) Apple may well have 3D,
     * so we say nothing rather than risk a wrong "terrain only". Never in the
     * standard map style, which draws its own 3D buildings almost everywhere.
     */
    showTerrainNote: ready?.coverage === 'no' && mapStyle !== 'standard',
    onReady: setReady,
  };
}
