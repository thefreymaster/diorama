import { Stack } from 'expo-router';

import { MAP_STYLES } from '@diorama/native';
import { setMapStyle, useSetting } from '@/features/settings/store';

import { MAP_STYLE_LABELS, MAP_STYLE_TITLE } from './mapStyleLabels';

/**
 * The preview's map button, top right like Apple Maps': a glass bar button
 * (a real UIBarButtonItem) that opens a native menu of map styles, a
 * checkmark on the one in use. The choice is saved in Settings' store, so
 * the Viewer and the Settings preview draw the same map. VoiceOver reads it
 * as "Map style, Satellite", with the menu as its actions. Renders nothing
 * itself.
 */
export function MapStyleMenu() {
  const mapStyle = useSetting('mapStyle');

  return (
    <Stack.Toolbar placement="right">
      <Stack.Toolbar.Menu
        icon="map"
        accessibilityLabel={`${MAP_STYLE_TITLE}, ${MAP_STYLE_LABELS[mapStyle]}`}
      >
        {/* A titled section, so later choices (T63's Traffic) can sit under it. */}
        <Stack.Toolbar.Menu inline title={MAP_STYLE_TITLE}>
          {MAP_STYLES.map((style) => (
            <Stack.Toolbar.MenuAction
              key={style}
              isOn={style === mapStyle}
              onPress={() => setMapStyle(style)}
            >
              {MAP_STYLE_LABELS[style]}
            </Stack.Toolbar.MenuAction>
          ))}
        </Stack.Toolbar.Menu>
      </Stack.Toolbar.Menu>
    </Stack.Toolbar>
  );
}
