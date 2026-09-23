import type { SFSymbol } from 'expo-symbols';
import { Pressable, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';

import { MAX_GLYPH_SCALE, metrics, spacing, useScaledSize } from '@/theme';

import { GlassSurface } from './GlassSurface';
import { canUseLiquidGlass } from './liquidGlass';
import { SymbolIcon } from './SymbolIcon';
import { Text } from './Text';
import { usePressScale } from './usePressScale';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type GlassButtonProps = {
  onPress: () => void;
  /** Label. Leave out for a round, symbol-only button. */
  title?: string;
  symbol?: SFSymbol;
  /** Required when there's no title, so VoiceOver can name the button. */
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

/**
 * A secondary control that floats over content: a glass capsule (or circle
 * when it's symbol-only). On iOS 26 the glass itself reacts to touch; older
 * iOS gets a spring shrink instead.
 */
export function GlassButton({
  onPress,
  title,
  symbol,
  accessibilityLabel,
  accessibilityHint,
}: GlassButtonProps) {
  const liquid = canUseLiquidGlass();
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(!liquid);
  const height = useScaledSize(metrics.glassButtonHeight);
  const shape = { height, minWidth: height, borderRadius: height / 2 };

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      style={[styles.pressable, animatedStyle]}
    >
      <GlassSurface interactive style={[styles.surface, shape, title ? styles.capsule : null]}>
        {symbol ? <SymbolIcon name={symbol} weight="semibold" /> : null}
        {/* The capsule's height stops growing at MAX_GLYPH_SCALE, so the label does too. */}
        {title ? (
          <Text variant="headline" maxFontSizeMultiplier={MAX_GLYPH_SCALE} numberOfLines={1}>
            {title}
          </Text>
        ) : null}
      </GlassSurface>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  pressable: { alignSelf: 'flex-start' },
  surface: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  capsule: { paddingHorizontal: spacing.lg },
});
