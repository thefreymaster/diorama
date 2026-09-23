import { BlurView } from 'expo-blur';
import { GlassView } from 'expo-glass-effect';
import type { ReactNode } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { canUseLiquidGlass } from './liquidGlass';

export type GlassSurfaceProps = {
  children?: ReactNode;
  /** Size, padding and a numeric `borderRadius` (glass ignores percentages). */
  style?: StyleProp<ViewStyle>;
  /** Let the glass react to touches (iOS 26). Set for buttons. */
  interactive?: boolean;
};

/**
 * A floating material over content (maps, photos). Liquid Glass on iOS 26+,
 * the system blur material on older iOS. Both adapt to light/dark mode and
 * turn opaque when the user has Reduce Transparency on.
 */
export function GlassSurface({ children, style, interactive = false }: GlassSurfaceProps) {
  if (canUseLiquidGlass()) {
    return (
      <GlassView glassEffectStyle="regular" isInteractive={interactive} style={style}>
        {children}
      </GlassView>
    );
  }

  return (
    <BlurView tint="systemMaterial" intensity={100} style={[styles.clip, style]}>
      {children}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden', borderCurve: 'continuous' },
});
