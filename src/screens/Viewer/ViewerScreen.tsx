import { useKeepAwake } from 'expo-keep-awake';
import { StatusBar } from 'expo-status-bar';
import { useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import type { DioramaMapViewRef } from '@diorama/native';
import { useExitButton } from '@/features/viewer/useExitButton';
import { useViewerCity } from '@/features/viewer/useViewerCity';
import { useViewerSession } from '@/features/viewer/useViewerSession';

import { ExitButton } from './ExitButton';
import { ViewerGestures } from './ViewerGestures';
import { ViewerHud } from './ViewerHud';
import { ViewerMap } from './ViewerMap';

/**
 * The diorama, worn in a viewer. Landscape and the hidden home indicator
 * come from the route options. The screen stays awake, double-tap
 * recenters, a long press exits, and the HUD appears only when it has
 * something to say. The one piece of chrome is a close button: always there
 * in stereo (in the black outside the eye windows), on a tap in mono.
 */
export function ViewerScreen() {
  useKeepAwake();
  const mapRef = useRef<DioramaMapViewRef>(null);
  const city = useViewerCity();
  const viewer = useViewerSession(mapRef);
  // `hudPerEye`: drawn as two eye windows (stereo, not cooled down to mono).
  const exitButton = useExitButton(viewer.hudPerEye);

  if (!city) return <View testID="viewer-screen" style={styles.fill} />;

  return (
    <View style={styles.fill}>
      <ViewerGestures
        onTap={exitButton.reveal}
        onRecenter={viewer.recenter}
        onExit={viewer.exit}
        accessibilityLabel={`3D view of ${city.name}`}
      >
        <StatusBar hidden />
        <ViewerMap
          ref={mapRef}
          city={city}
          headTracking={viewer.headTracking}
          onReady={viewer.onReady}
          onDegraded={viewer.onDegraded}
        />
        <ViewerHud hud={viewer.hud} perEye={viewer.hudPerEye} />
      </ViewerGestures>
      {/* Beside the gestures' view, not in it: VoiceOver can reach it there,
          and a tap on it is only a press, never a tap on the view too. */}
      <ExitButton visible={exitButton.visible} onPress={viewer.exit} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
