import type { SFSymbol } from 'expo-symbols';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';

import { colors, metrics, spacing, type ColorToken } from '@/theme';

import { SymbolIcon } from './SymbolIcon';
import { Text } from './Text';
import { usePressScale } from './usePressScale';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type PrimaryButtonProps = {
  title: string;
  onPress: () => void;
  /** Leading SF Symbol. */
  symbol?: SFSymbol;
  disabled?: boolean;
  /** Shows a spinner in place of the label and ignores taps. */
  loading?: boolean;
  accessibilityHint?: string;
};

/** The screen's main action: a filled, full-width capsule in the app tint. */
export function PrimaryButton({
  title,
  onPress,
  symbol,
  disabled = false,
  loading = false,
  accessibilityHint,
}: PrimaryButtonProps) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();
  const foreground: ColorToken = disabled ? 'tertiaryLabel' : 'onTint';

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled, busy: loading }}
      style={[styles.button, disabled && styles.disabled, animatedStyle]}
    >
      {loading ? (
        <ActivityIndicator color={colors.onTint} />
      ) : (
        <>
          {symbol ? <SymbolIcon name={symbol} weight="semibold" color={foreground} /> : null}
          <Text variant="headline" color={foreground} style={styles.label}>
            {title}
          </Text>
        </>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: metrics.prominentButtonHeight,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: metrics.prominentButtonHeight,
    backgroundColor: colors.tint,
  },
  disabled: {
    backgroundColor: colors.tertiarySystemFill,
  },
  // At the largest text sizes the label wraps inside the capsule, which grows.
  label: {
    flexShrink: 1,
    textAlign: 'center',
  },
});
