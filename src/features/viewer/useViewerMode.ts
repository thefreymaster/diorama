import { useWindowDimensions } from 'react-native';

import type { DioramaViewMode } from '@diorama/native';
import { useSetting } from '@/features/settings/store';

/** How the phone is held in the Viewer. It never turns upside down. */
export type ViewerOrientation = 'portrait' | 'landscape';

/**
 * How the phone is held right now, from the window's shape: wider than tall
 * is sideways (either way round). Updates as the phone turns.
 */
export function useViewerOrientation(): ViewerOrientation {
  const { width, height } = useWindowDimensions();
  return width > height ? 'landscape' : 'portrait';
}

/**
 * Sideways is the headset: a round picture per eye (stereo), unless "Two-eye
 * view in landscape" is off. Upright is always one full-screen picture,
 * held like a window into the city.
 */
export function viewerMode(
  orientation: ViewerOrientation,
  twoEyeLandscape: boolean,
): DioramaViewMode {
  return orientation === 'landscape' && twoEyeLandscape ? 'stereo' : 'mono';
}

/** The Viewer's mode for how the phone is held now, and the Settings. */
export function useViewerMode(): DioramaViewMode {
  const orientation = useViewerOrientation();
  const twoEyeLandscape = useSetting('twoEyeLandscape');
  return viewerMode(orientation, twoEyeLandscape);
}
