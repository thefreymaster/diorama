import { mapStyleShown, type DioramaMapStyle } from '@diorama/native';
import { setMapStyle, setShowsTraffic, useSetting } from '@/features/settings/store';

import { MAP_STYLE_LABELS, MAP_STYLE_TITLE } from './mapStyleLabels';

/**
 * What the preview's map menu shows and does. The checkmark sits on the
 * style the map is drawn in: with traffic on, Satellite is drawn with
 * labels (imagery alone can't show traffic), so that's the one checked.
 * Picking Satellite then means imagery with nothing on top, so it turns
 * traffic off; turning traffic off by itself goes back to the style chosen
 * before.
 */
export function useMapMenu() {
  const mapStyle = useSetting('mapStyle');
  const showsTraffic = useSetting('showsTraffic');
  const shownStyle = mapStyleShown(mapStyle, showsTraffic);
  const styleName = MAP_STYLE_LABELS[shownStyle];

  return {
    /** The style with the checkmark: the one the map is drawn in. */
    shownStyle,
    showsTraffic,
    /** VoiceOver's name for the map button, e.g. "Map style, Satellite". */
    accessibilityLabel: showsTraffic
      ? `${MAP_STYLE_TITLE}, ${styleName}, with traffic`
      : `${MAP_STYLE_TITLE}, ${styleName}`,
    chooseStyle(style: DioramaMapStyle) {
      if (style === 'satellite') setShowsTraffic(false);
      setMapStyle(style);
    },
    toggleTraffic() {
      setShowsTraffic(!showsTraffic);
    },
  };
}
