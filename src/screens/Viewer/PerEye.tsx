import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';

// In stereo the native view splits the screen into two equal halves, one per
// eye, so a copy centered in each half sits dead ahead of each eye and fuses
// at the depth of the city's center.
const STEREO_EYES = ['left', 'right'] as const;
const MONO_EYES = ['both'] as const;

type PerEyeProps = {
  /** Draw `children` once per eye (stereo), or once in the middle (mono). */
  perEye: boolean;
  children: ReactNode;
};

/**
 * An overlay that shows its content where each eye looks. It never takes
 * touches, and VoiceOver skips it (the HUD announces itself instead).
 */
export function PerEye({ perEye, children }: PerEyeProps) {
  const eyes = perEye ? STEREO_EYES : MONO_EYES;

  return (
    <View
      style={styles.overlay}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {eyes.map((eye) => (
        <View key={eye} testID={`hud-eye-${eye}`} style={styles.eye}>
          {children}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
    pointerEvents: 'none',
  },
  eye: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
});
