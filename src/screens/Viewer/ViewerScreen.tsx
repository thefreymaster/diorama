import { useKeepAwake } from 'expo-keep-awake';
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
 * The diorama. Held upright it's one full-screen picture, a window into the
 * city; turned sideways it's the two-eye view for a headset viewer, and it
 * switches as the phone turns (the route allows every orientation but
 * upside down, and hides the status bar and home indicator). The screen
 * stays awake, double-tap recenters, a long press exits, and the HUD appears
 * only when it has something to say. The one piece of chrome is a close
 * button: always there in stereo (in the black outside the eye windows), on
 * a tap in mono.
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
        lookDrag={viewer.lookDrag}
        pinchZoom={viewer.pinchZoom}
        onTap={exitButton.reveal}
        onRecenter={viewer.recenter}
        onExit={viewer.exit}
        accessibilityLabel={`3D view of ${city.name}`}
      >
        <ViewerMap
          ref={mapRef}
          city={city}
          mode={viewer.mode}
          headTracking={viewer.headTracking}
          headPosition={viewer.headPosition}
          onReady={viewer.onReady}
          onDegraded={viewer.onDegraded}
          onHeadPositionState={viewer.onHeadPositionState}
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
