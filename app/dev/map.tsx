import { Redirect, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { Button, StyleSheet, View } from 'react-native';

import {
  DioramaMapView,
  requestCameraAccess,
  type DioramaHeadPositionState,
  type DioramaHeadPositionStats,
  type DioramaLean,
  type DioramaMapViewRef,
  type DioramaThermalState,
  type DioramaViewMode,
  type FlyoverCoverage,
} from '@diorama/native';
import { useSetting } from '@/features/settings/store';
import { colors, spacing } from '@/theme';
import { Text } from '@/ui';

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
  headPosition?: string;
  leanGain?: string;
  leanVertical?: string;
  leanVerticalFlip?: string;
  lean?: string;
  leanAfter?: string;
  leanLost?: string;
  stats?: string;
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

// `lean=right,up,forward` in meters, e.g. `0,-0.2,0` for 20 cm down.
function leanParam(value: string | undefined): DioramaLean | null {
  const parts = (value ?? '').split(',').map(Number);
  if (parts.length !== 3 || !parts.every(Number.isFinite)) return null;
  const [right, up, forward] = parts as [number, number, number];
  return { right, up, forward };
}

// Seconds the fake head takes to lean in (a person leans in about this long).
const LEAN_SECONDS = 1;
const LEAN_STEPS_PER_SECOND = 30;

/**
 * Simulator stand-in for leaning (no ARKit there): `after` seconds once the
 * map is ready, the fake head glides to `lean` over a second through
 * `setDebugLean`; `lostAfter` seconds after ready, it acts as if ARKit lost
 * track (the lean then holds and eases back).
 */
function useScriptedLean(
  mapRef: RefObject<DioramaMapViewRef | null>,
  script: { ready: boolean; lean: DioramaLean | null; after: number; lostAfter: number | null },
) {
  const { ready, lean, after, lostAfter } = script;
  const { right = 0, up = 0, forward = 0 } = lean ?? {};
  const hasLean = lean !== null;
  useEffect(() => {
    if (!ready || (!hasLean && lostAfter === null)) return;
    let step = 0;
    let glide: ReturnType<typeof setInterval> | undefined;
    const leanAt = (share: number, tracking: boolean) =>
      void mapRef.current?.setDebugLean(right * share, up * share, forward * share, tracking);
    // Each script starts from the head at rest (a reopened URL keeps the screen).
    leanAt(0, true);
    const start = setTimeout(() => {
      if (!hasLean) return;
      glide = setInterval(() => {
        step += 1;
        const t = Math.min(step / (LEAN_SECONDS * LEAN_STEPS_PER_SECOND), 1);
        leanAt(t * t * (3 - 2 * t), true); // Eased in and out, like a real lean.
        if (t >= 1) clearInterval(glide);
      }, 1000 / LEAN_STEPS_PER_SECOND);
    }, after * 1000);
    const lose =
      lostAfter === null
        ? undefined
        : setTimeout(() => leanAt(hasLean ? 1 : 0, false), lostAfter * 1000);
    return () => {
      clearTimeout(start);
      clearTimeout(lose);
      clearInterval(glide);
    };
  }, [mapRef, ready, hasLean, right, up, forward, after, lostAfter]);
}

/**
 * `leanVertical` as the dev map's params ask: `on` to start, flipped once
 * `flipAfter` seconds after the map is ready (to watch a switch mid-lean).
 */
function useFlippedLeanVertical(ready: boolean, on: boolean, flipAfter: number | null): boolean {
  // Which script the flip belonged to: new params start over, unflipped.
  const script = `${ready}:${on}:${flipAfter}`;
  const [flippedScript, setFlippedScript] = useState<string | null>(null);
  useEffect(() => {
    if (!ready || flipAfter === null) return;
    const flip = setTimeout(() => setFlippedScript(script), flipAfter * 1000);
    return () => clearTimeout(flip);
  }, [ready, flipAfter, script]);
  return flippedScript === script ? !on : on;
}

function formatLean({ right, up, forward }: DioramaLean, unit: number, digits: number): string {
  return [right, up, forward].map((value) => (value * unit).toFixed(digits)).join(' / ');
}

// The readout's lines: state and ARKit's timing, the head's move (cm, right
// / up / forward) and where it puts you in the city (m), and your height.
function statsText(
  state: DioramaHeadPositionState,
  stats: DioramaHeadPositionStats | null,
): string {
  if (!stats) return `Head position: ${state}`;
  return [
    `${state} · ${stats.framesPerSecond.toFixed(0)} fps · pose ${stats.poseAgeMs.toFixed(0)} ms · miss ${stats.predictionErrorMm.toFixed(2)} mm · jitter ${stats.jitterMm.toFixed(2)} mm`,
    `head ${formatLean(stats.move, 100, 1)} cm → city ${formatLean(stats.lean, 1, 1)} m (×${stats.metersPerMeter.toFixed(0)})`,
    `height ${stats.height.toFixed(1)} m · ground ahead ${stats.distance.toFixed(1)} m`,
  ].join('\n');
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
 * Head position (lean to get closer, needs `headTracking=1`): `headPosition=1`,
 * `leanGain=2`. On a device it asks for the camera first. In the Simulator
 * (with `debugLook=1`) a fake head stands in: `lean=0,-0.2,0` (meters right,
 * up, forward) glides it there `leanAfter=3` seconds after the map is ready,
 * and `leanLost=8` acts as if ARKit lost track 8 s after ready. `leanVertical=0`
 * leaves up and down out of the lean (T61); `leanVerticalFlip=6` flips it 6 s
 * after ready. `stats=1` shows head position's numbers (ARKit timing and
 * jitter, the lean, height).
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
  const [positionState, setPositionState] = useState<DioramaHeadPositionState>('off');
  const [stats, setStats] = useState<DioramaHeadPositionStats | null>(null);
  const debugLook = flagParam(params.debugLook, savedDebugLook);
  const headPosition = flagParam(params.headPosition, false);
  const showStats = flagParam(params.stats, false);
  const leanVertical = useFlippedLeanVertical(
    coverage !== null,
    flagParam(params.leanVertical, true),
    params.leanVerticalFlip === undefined ? null : numberParam(params.leanVerticalFlip, 0),
  );

  useScriptedLean(mapRef, {
    ready: coverage !== null,
    lean: leanParam(params.lean),
    after: numberParam(params.leanAfter, 3),
    lostAfter: params.leanLost === undefined ? null : numberParam(params.leanLost, 0),
  });

  // A device tracks the real head: ask for the camera once, up front.
  useEffect(() => {
    if (__DEV__ && headPosition && !debugLook) void requestCameraAccess();
  }, [headPosition, debugLook]);

  if (!__DEV__) return <Redirect href="/" />;

  const loadTitle = coverage === null ? 'Loading' : COVERAGE_TITLES[coverage];
  const title = degraded ? `${loadTitle} · Mono (hot)` : loadTitle;
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
        headPosition={headPosition}
        leanGain={numberParam(params.leanGain, 1)}
        leanVertical={leanVertical}
        mode={mode}
        eyeSeparation={numberParam(params.eyeSeparation, savedEyeSeparation)}
        miniatureIntensity={numberParam(params.miniature, savedMiniature)}
        debugThermalState={thermalParam(params.thermal)}
        onReady={(event) => setCoverage(event.coverage)}
        onDegraded={() => setDegraded(true)}
        onHeadPositionState={(event) => setPositionState(event.state)}
        onHeadPositionStats={showStats ? setStats : undefined}
      />
      {showStats && (
        <View style={styles.readout} pointerEvents="none">
          <Text variant="caption2" style={styles.readoutText}>
            {statsText(positionState, stats)}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  actions: { flexDirection: 'row' },
  readout: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.huge,
    padding: spacing.sm,
    borderRadius: spacing.sm,
    backgroundColor: colors.secondarySystemBackground,
  },
  readoutText: { fontVariant: ['tabular-nums'] },
});
