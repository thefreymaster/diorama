import type { DioramaMapStyle } from '@diorama/native';

/** What the map menu calls each map style. */
export const MAP_STYLE_LABELS: Readonly<Record<DioramaMapStyle, string>> = {
  satellite: 'Satellite',
  hybrid: 'Satellite with labels',
  standard: 'Standard',
};

/** The menu section's heading, and the start of the button's VoiceOver name. */
export const MAP_STYLE_TITLE = 'Map style';
