import { useKeepAwake } from 'expo-keep-awake';
import { StatusBar } from 'expo-status-bar';
import { useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import type { DioramaMapViewRef } from '@diorama/native';
import { useViewerCity } from '@/features/viewer/useViewerCity';
import { useViewerSession } from '@/features/viewer/useViewerSession';

import { ViewerGestures } from './ViewerGestures';
import { ViewerHud } from './ViewerHud';
import { ViewerMap } from './ViewerMap';

/**
 * The diorama, worn in a viewer. Landscape and the hidden home indicator
 * come from the route options; this adds no chrome at all. The screen stays
 * awake, double-tap recenters, a long press exits, and the HUD appears only
 * when it has something to say.
 */
export function ViewerScreen() {
  useKeepAwake();
  const mapRef = useRef<DioramaMapViewRef>(null);
  const city = useViewerCity();
  const viewer = useViewerSession(mapRef);

  if (!city) return <View testID="viewer-screen" style={styles.fill} />;

  return (
    <ViewerGestures
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
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
