import { useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';

import type { City } from '@/features/cities/queries';
import { useViewpoints } from '@/features/viewpoints/queries';
import { colors, metrics, spacing } from '@/theme';
import { SymbolIcon, Text, selectionHaptic, usePressScale } from '@/ui';

import { SpringReveal } from './SpringReveal';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type ViewpointsRowProps = {
  city: City;
};

/**
 * "Viewpoints" in the preview card: a gray capsule, like the secondary
 * buttons on an Apple Maps place card, that opens the list of scenic views
 * and visitor centers around the place. It opens up once Apple Maps has
 * found some, and stays away otherwise (see `useViewpoints`).
 */
export function ViewpointsRow({ city }: ViewpointsRowProps) {
  const { viewpoints } = useViewpoints(city);
  const router = useRouter();
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();

  if (viewpoints.length === 0) return null;

  const openList = () => {
    selectionHaptic();
    router.push({ pathname: '/viewpoints/[cityId]', params: { cityId: city.id } });
  };

  return (
    <SpringReveal paddingTop={spacing.lg} testID="viewpoints-row">
      <AnimatedPressable
        onPress={openList}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        accessibilityRole="button"
        accessibilityLabel={`Viewpoints, ${viewpoints.length} nearby`}
        accessibilityHint="Lists scenic views and visitor centers nearby."
        style={[styles.capsule, animatedStyle]}
      >
        <SymbolIcon name="binoculars.fill" color="tint" weight="semibold" />
        <Text style={styles.title}>Viewpoints</Text>
        <Text color="secondaryLabel">{viewpoints.length}</Text>
        <SymbolIcon name="chevron.right" size={14} weight="semibold" color="tertiaryLabel" />
      </AnimatedPressable>
    </SpringReveal>
  );
}

const styles = StyleSheet.create({
  capsule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: metrics.glassButtonHeight,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: metrics.glassButtonHeight,
    borderCurve: 'continuous',
    backgroundColor: colors.tertiarySystemFill,
  },
  title: { flex: 1 },
});
