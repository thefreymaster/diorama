import { Pressable, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';

import { metrics, useScaledSize } from '@/theme';
import { canUseLiquidGlass, GlassSurface, SymbolIcon, usePressScale } from '@/ui';

import { useExitButtonOrigin } from './useExitButtonOrigin';
import { useHudFade } from './useHudFade';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type ExitButtonProps = {
  /** Shows (springs in) or hides (springs out, and stops taking touches). */
  visible: boolean;
  onPress: () => void;
};

/**
 * A round glass close button in the top-left corner: a way out anyone can
 * see once the phone is out of the headset. In stereo it sits in the black
 * outside both eye windows. Dark glass with a white glyph in light mode too,
 * like a video player's controls, since it's over black or the city.
 *
 * It's a glass circle rather than a `GlassButton` so the glass can
 * materialize and dissolve itself: Liquid Glass isn't drawn at all under a
 * parent that is being faded. It fades like the HUD (`useHudFade`), with no
 * scale under Reduce Motion.
 */
export function ExitButton({ visible, onPress }: ExitButtonProps) {
  const size = useScaledSize(metrics.glassButtonHeight);
  const origin = useExitButtonOrigin(size);
  const fade = useHudFade(visible);
  // On iOS 26 the glass itself reacts to the finger; older iOS shrinks it.
  const press = usePressScale(!canUseLiquidGlass());
  const frame = { left: origin.x, top: origin.y, width: size, height: size };
  const circle = { width: size, height: size, borderRadius: size / 2 };

  return (
    <Animated.View
      testID="viewer-exit"
      style={[
        styles.overlay,
        frame,
        { pointerEvents: visible ? 'auto' : 'none' },
        fade.containerStyle,
      ]}
      // Out of VoiceOver's way while hidden; the view's Exit action stays.
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
    >
      <AnimatedPressable
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        accessibilityRole="button"
        accessibilityLabel="Exit"
        style={press.animatedStyle}
      >
        <GlassSurface
          interactive
          colorScheme="dark"
          visible={fade.glassVisible}
          style={[styles.circle, circle]}
        >
          <Animated.View testID="viewer-exit-glyph" style={fade.contentStyle}>
            <SymbolIcon name="xmark" weight="semibold" color="onTint" />
          </Animated.View>
        </GlassSurface>
      </AnimatedPressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute' },
  circle: { alignItems: 'center', justifyContent: 'center' },
});
