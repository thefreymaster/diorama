import { useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import type { Viewpoint } from '@/features/viewpoints/viewpoints';

/**
 * Opens the viewpoint a link names (`?open=<viewpoint id>`, e.g.
 * `diorama://viewpoints/grand-canyon?open=mather-point_36.062_-112.108`)
 * as soon as the list has it, as if it were tapped. The Simulator can't tap
 * from a script, so this is how it tests the whole path.
 */
export function useOpenLinkedViewpoint(
  viewpoints: readonly Viewpoint[],
  open: (viewpoint: Viewpoint) => void,
) {
  const { open: linkedId } = useLocalSearchParams<{ open?: string }>();
  const linked = linkedId ? viewpoints.find((viewpoint) => viewpoint.id === linkedId) : undefined;

  useEffect(() => {
    if (linked) open(linked);
  }, [linked, open]);
}
