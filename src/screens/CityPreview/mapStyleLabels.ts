import type { DioramaMapStyle } from '@diorama/native';

/** What the map menu calls each map style. */
export const MAP_STYLE_LABELS: Readonly<Record<DioramaMapStyle, string>> = {
  satellite: 'Satellite',
  hybrid: 'Satellite with labels',
  standard: 'Standard',
};

/** The menu section's heading, and the start of the button's VoiceOver name. */
export const MAP_STYLE_TITLE = 'Map style';

/** The map menu's traffic switch, and the line under it. */
export const TRAFFIC_LABEL = 'Traffic';
export const TRAFFIC_SUBTITLE = 'Live traffic from Apple Maps';
