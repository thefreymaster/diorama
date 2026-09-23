import { create } from 'zustand';

import type { DioramaEyeLayout, DioramaStereoEyes } from './DioramaMapView.types';

type EyeLayoutState = {
  /** The stereo map that reported `eyes` (an id per mounted map), or `null`. */
  owner: string | null;
  eyes: DioramaStereoEyes | null;
};

const useEyeLayoutStore = create<EyeLayoutState>()(() => ({ owner: null, eyes: null }));

/**
 * Where each eye's window is on the stereo map that's on screen, in its own
 * points, or `null` when no map is in stereo (or it hasn't laid out yet).
 * For overlays drawn once per eye, like the Viewer's HUD. Every
 * `<DioramaMapView>` keeps this up to date on its own.
 */
export function useStereoEyes(): DioramaStereoEyes | null {
  return useEyeLayoutStore((state) => state.eyes);
}

/** A map's latest layout (DioramaMapView calls this from `onEyeLayout`). */
export function reportEyeLayout(owner: string, layout: DioramaEyeLayout): void {
  if (layout.mode === 'stereo') {
    useEyeLayoutStore.setState({ owner, eyes: { left: layout.left, right: layout.right } });
  } else {
    forgetEyeLayout(owner);
  }
}

/** A map that went mono or away takes its eyes with it. */
export function forgetEyeLayout(owner: string): void {
  if (useEyeLayoutStore.getState().owner === owner) {
    useEyeLayoutStore.setState({ owner: null, eyes: null });
  }
}
