import { Redirect, Stack, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Button, StyleSheet, View } from 'react-native';

import {
  DioramaMapView,
  type DioramaMapViewRef,
  type DioramaThermalState,
  type DioramaViewMode,
  type FlyoverCoverage,
} from '@diorama/native';
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
  mode?: string;
  eyeSeparation?: string;
  thermal?: string;
  miniature?: string;
};

type ScreenOrientation = 'portrait' | 'landscape' | 'landscape_left' | 'landscape_right';

// Midtown Manhattan. The street grid runs ~29° east of north, so this
// heading looks straight up the avenues.
const MANHATTAN = { lat: 40.7549, lon: -73.984, altitude: 1200, pitch: 60, heading: 29 };
const TURN_STEP_DEGREES = 45;
// "Peek" sets the debug look to 30° right and 20° down.
const PEEK = { dx: 30, dy: -20 };
// The header once the map has drawn: 3D coverage from the hand-checked lists.
const COVERAGE_TITLES: Record<FlyoverCoverage, string> = {
  yes: 'Flyover 3D',
  no: 'No Flyover',
  unknown: 'Flyover unknown',
};

function numberParam(value: string | undefined, fallback: number): number {
  const parsed = value === undefined ? NaN : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function flagParam(value: string | undefined, fallback: boolean): boolean {
  return value === undefined ? fallback : value === '1' || value === 'true';
}

function modeParam(value: string | undefined, fallback: DioramaViewMode): DioramaViewMode {
  return value === 'mono' || value === 'stereo' ? value : fallback;
}

const THERMAL_STATES: readonly DioramaThermalState[] = ['nominal', 'fair', 'serious', 'critical'];

function thermalParam(value: string | undefined): DioramaThermalState | undefined {
  return THERMAL_STATES.find((state) => state === value);
}

// `left`/`right` pick UIKit's landscapeLeft/landscapeRight; `1` allows both.
function orientationParam(value: string | undefined, fallback: boolean): ScreenOrientation {
  if (value === 'left') return 'landscape_left';
  if (value === 'right') return 'landscape_right';
  return flagParam(value, fallback) ? 'landscape' : 'portrait';
}

/**
 * Dev-only map check:
 * diorama://dev/map?lat=&lon=&altitude=&pitch=&heading=&orbit=1
 *   &headTracking=1&debugLook=1&sensitivity=1.5&landscape=left|right|1
 *   &mode=mono|stereo&eyeSeparation=1&thermal=serious|critical&miniature=0.6
 * "Turn" changes the heading prop from JS; "Recenter" and "Peek" call the
 * ref methods. With `headTracking=1&debugLook=1`, dragging looks around
 * (the Simulator has no gyro); on a device, drop `debugLook` to use motion.
 * `mode=stereo` shows two eyes (landscape unless `landscape=0`); `thermal` pretends
 * the phone is that hot. `miniature` is the tilt-shift strength (0 = off, 1 = max).
 * Unset params default to the Settings values (`mode` defaults to mono here).
 */
export default function DevMapRoute() {
  const params = useLocalSearchParams<MapParams>();
  const savedSensitivity = useSetting('trackingSensitivity');
  const savedDebugLook = useSetting('debugLook');
  const savedEyeSeparation = useSetting('eyeSeparation');
  const savedMiniature = useSetting('miniatureIntensity');
  const mapRef = useRef<DioramaMapViewRef>(null);
  const [turn, setTurn] = useState(0);
  const [coverage, setCoverage] = useState<FlyoverCoverage | null>(null);
  const [degraded, setDegraded] = useState(false);

  if (!__DEV__) return <Redirect href="/" />;

  const loadTitle = coverage === null ? 'Loading' : COVERAGE_TITLES[coverage];
  const title = degraded ? `${loadTitle} · Mono (hot)` : loadTitle;
  const debugLook = flagParam(params.debugLook, savedDebugLook);
  const mode = modeParam(params.mode, 'mono');

  return (
    <View style={styles.fill}>
      <Stack.Screen
        options={{
          title,
          headerTransparent: true,
          orientation: orientationParam(params.landscape, mode === 'stereo'),
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
        mode={mode}
        eyeSeparation={numberParam(params.eyeSeparation, savedEyeSeparation)}
        miniatureIntensity={numberParam(params.miniature, savedMiniature)}
        debugThermalState={thermalParam(params.thermal)}
        onReady={(event) => setCoverage(event.coverage)}
        onDegraded={() => setDegraded(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  actions: { flexDirection: 'row' },
});
