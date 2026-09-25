import { Stack } from 'expo-router';

import { MAP_STYLES } from '@diorama/native';

import {
  MAP_STYLE_LABELS,
  MAP_STYLE_TITLE,
  TRAFFIC_LABEL,
  TRAFFIC_SUBTITLE,
} from './mapStyleLabels';
import { useMapMenu } from './useMapMenu';

/**
 * The preview's map button, top right like Apple Maps': a glass bar button
 * (a real UIBarButtonItem) that opens a native menu of map styles, a
 * checkmark on the one in use, and below them a Traffic switch (a
 * checkmark when on). The choices are saved in Settings' store, so the
 * Viewer and the Settings preview draw the same map. VoiceOver reads it as
 * "Map style, Satellite", with the menu as its actions. Renders nothing
 * itself.
 */
export function MapStyleMenu() {
  const menu = useMapMenu();

  return (
    <Stack.Toolbar placement="right">
      <Stack.Toolbar.Menu icon="map" accessibilityLabel={menu.accessibilityLabel}>
        <Stack.Toolbar.Menu inline title={MAP_STYLE_TITLE}>
          {MAP_STYLES.map((style) => (
            <Stack.Toolbar.MenuAction
              key={style}
              isOn={style === menu.shownStyle}
              onPress={() => menu.chooseStyle(style)}
            >
              {MAP_STYLE_LABELS[style]}
            </Stack.Toolbar.MenuAction>
          ))}
        </Stack.Toolbar.Menu>
        <Stack.Toolbar.Menu inline>
          <Stack.Toolbar.MenuAction
            isOn={menu.showsTraffic}
            subtitle={TRAFFIC_SUBTITLE}
            onPress={menu.toggleTraffic}
          >
            {TRAFFIC_LABEL}
          </Stack.Toolbar.MenuAction>
        </Stack.Toolbar.Menu>
      </Stack.Toolbar.Menu>
    </Stack.Toolbar>
  );
}
