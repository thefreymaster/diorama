import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { useStereoEyes, type DioramaStereoEyes } from '@diorama/native';
import { spacing } from '@/theme';

import { useCircleFit } from './useCircleFit';

// In stereo the native view draws each eye in a circle centered on one of
// the headset's lenses, and reports the square around it, so a copy centered
// in each square sits dead ahead of each eye and fuses at the depth of the
// city's center. Until the map has reported its windows, each copy is
// centered in its half of the screen.
const STEREO_EYES = ['left', 'right'] as const;
const MONO_EYES = ['both'] as const;

type Eye = (typeof STEREO_EYES)[number] | (typeof MONO_EYES)[number];

type PerEyeProps = {
  /** Draw `children` once per eye (stereo), or once in the middle (mono). */
  perEye: boolean;
  children: ReactNode;
};

/**
 * An overlay that shows its content where each eye looks, kept inside each
 * eye's circle. It never takes touches, and VoiceOver skips it (the HUD
 * announces itself instead).
 */
export function PerEye({ perEye, children }: PerEyeProps) {
  const windows = useStereoEyes();
  const eyes = perEye ? STEREO_EYES : MONO_EYES;
  // The copies are identical, so one fit serves both and they always match.
  const fit = useCircleFit(perEye && windows ? circleDiameter(windows) : null);

  return (
    <View
      style={styles.overlay}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {eyes.map((eye) => (
        <View key={eye} testID={`hud-eye-${eye}`} style={eyeStyle(eye, windows)}>
          <View testID={`hud-fit-${eye}`} onLayout={fit.onLayout} style={fit.style}>
            {children}
          </View>
        </View>
      ))}
    </View>
  );
}

/** Each eye's circle fills the square the map reports around it. */
function circleDiameter({ left }: DioramaStereoEyes): number {
  return Math.min(left.width, left.height);
}

/** One eye's box: its lens window when known, else its share of the screen. */
function eyeStyle(eye: Eye, windows: DioramaStereoEyes | null): ViewStyle[] {
  if (eye === 'both' || !windows) return [styles.eye, styles.share];
  const { x, y, width, height } = windows[eye];
  return [styles.eye, styles.window, { left: x, top: y, width, height }];
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
    pointerEvents: 'none',
  },
  eye: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  share: {
    flex: 1,
    paddingHorizontal: spacing.xl,
  },
  // The circle's own fit (`useCircleFit`) keeps the HUD clear of its edge.
  window: {
    position: 'absolute',
  },
});
