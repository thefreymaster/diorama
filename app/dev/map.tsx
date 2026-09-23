import { Redirect, Stack, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Button, StyleSheet, View } from 'react-native';

import { DioramaMapView, type DioramaMapViewRef } from '@diorama/native';
import { useSetting } from '@/features/settings/store';

type MapParams = {
  lat?: string;
  lon?: string;
  altitude?: string;
  pitch?: string;
  heading?: string;
  orbit?: string;
  headTracking?: string;
  debugLook?: string;
  sensitivity?: string;
  landscape?: string;
};

type ScreenOrientation = 'portrait' | 'landscape' | 'landscape_left' | 'landscape_right';

// Midtown Manhattan. The street grid runs ~29° east of north, so this
// heading looks straight up the avenues.
const MANHATTAN = { lat: 40.7549, lon: -73.984, altitude: 1200, pitch: 60, heading: 29 };
const TURN_STEP_DEGREES = 45;
// "Peek" sets the debug look to 30° right and 20° down.
const PEEK = { dx: 30, dy: -20 };

function numberParam(value: string | undefined, fallback: number): number {
  const parsed = value === undefined ? NaN : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function flagParam(value: string | undefined, fallback: boolean): boolean {
  return value === undefined ? fallback : value === '1' || value === 'true';
}

// `left`/`right` pick UIKit's landscapeLeft/landscapeRight; `1` allows both.
function orientationParam(value: string | undefined): ScreenOrientation {
  if (value === 'left') return 'landscape_left';
  if (value === 'right') return 'landscape_right';
  return flagParam(value, false) ? 'landscape' : 'portrait';
}

/**
 * Dev-only map check:
 * diorama://dev/map?lat=&lon=&altitude=&pitch=&heading=&orbit=1
 *   &headTracking=1&debugLook=1&sensitivity=1.5&landscape=left|right|1
 * "Turn" changes the heading prop from JS; "Recenter" and "Peek" call the
 * ref methods. With `headTracking=1&debugLook=1`, dragging looks around
 * (the Simulator has no gyro); on a device, drop `debugLook` to use motion.
 * `debugLook` and `sensitivity` default to the Settings values.
 */
export default function DevMapRoute() {
  const params = useLocalSearchParams<MapParams>();
  const savedSensitivity = useSetting('trackingSensitivity');
  const savedDebugLook = useSetting('debugLook');
  const mapRef = useRef<DioramaMapViewRef>(null);
  const [turn, setTurn] = useState(0);
  const [flyover, setFlyover] = useState<boolean | null>(null);

  if (!__DEV__) return <Redirect href="/" />;

  const title = flyover === null ? 'Loading' : flyover ? 'Flyover 3D' : 'No Flyover';
  const debugLook = flagParam(params.debugLook, savedDebugLook);

  return (
    <View style={styles.fill}>
      <Stack.Screen
        options={{
          title,
          headerTransparent: true,
          orientation: orientationParam(params.landscape),
          headerRight: () => (
            <View style={styles.actions}>
              <Button title="Turn" onPress={() => setTurn((t) => t + TURN_STEP_DEGREES)} />
              {debugLook && (
                <Button
                  title="Peek"
                  onPress={() => void mapRef.current?.setDebugLook(PEEK.dx, PEEK.dy)}
                />
              )}
              <Button title="Recenter" onPress={() => void mapRef.current?.recenter()} />
            </View>
          ),
        }}
      />
      <DioramaMapView
        ref={mapRef}
        style={styles.fill}
        center={{
          latitude: numberParam(params.lat, MANHATTAN.lat),
          longitude: numberParam(params.lon, MANHATTAN.lon),
        }}
        altitude={numberParam(params.altitude, MANHATTAN.altitude)}
        pitch={numberParam(params.pitch, MANHATTAN.pitch)}
        heading={numberParam(params.heading, MANHATTAN.heading) + turn}
        orbit={flagParam(params.orbit, false)}
        headTracking={flagParam(params.headTracking, false)}
        debugLook={debugLook}
        trackingSensitivity={numberParam(params.sensitivity, savedSensitivity)}
        onReady={({ flyoverAvailable }) => setFlyover(flyoverAvailable)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  actions: { flexDirection: 'row' },
});
