import { Redirect, Stack, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Button, StyleSheet, View } from 'react-native';

import { DioramaMapView, type DioramaMapViewRef } from '../../modules/diorama-native';

type MapParams = {
  lat?: string;
  lon?: string;
  altitude?: string;
  pitch?: string;
  heading?: string;
  orbit?: string;
};

// Midtown Manhattan. The street grid runs ~29° east of north, so this
// heading looks straight up the avenues.
const MANHATTAN = { lat: 40.7549, lon: -73.984, altitude: 1200, pitch: 60, heading: 29 };
const TURN_STEP_DEGREES = 45;

function numberParam(value: string | undefined, fallback: number): number {
  const parsed = value === undefined ? NaN : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Dev-only map check: diorama://dev/map?lat=&lon=&altitude=&pitch=&heading=&orbit=1
 * "Turn" changes the heading prop from JS; "Recenter" calls the ref method.
 */
export default function DevMapRoute() {
  const params = useLocalSearchParams<MapParams>();
  const mapRef = useRef<DioramaMapViewRef>(null);
  const [turn, setTurn] = useState(0);
  const [flyover, setFlyover] = useState<boolean | null>(null);

  if (!__DEV__) return <Redirect href="/" />;

  const title = flyover === null ? 'Loading' : flyover ? 'Flyover 3D' : 'No Flyover';

  return (
    <View style={styles.fill}>
      <Stack.Screen
        options={{
          title,
          headerTransparent: true,
          headerRight: () => (
            <View style={styles.actions}>
              <Button title="Turn" onPress={() => setTurn((t) => t + TURN_STEP_DEGREES)} />
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
        orbit={params.orbit === '1' || params.orbit === 'true'}
        onReady={({ flyoverAvailable }) => setFlyover(flyoverAvailable)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  actions: { flexDirection: 'row' },
});
