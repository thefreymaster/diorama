import { useEffect } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { spacing, springConfig, springs, useReduceMotion } from '@/theme';
import { Text } from '@/ui';

export const TERRAIN_NOTE = "3D buildings aren't available here. Terrain only.";

/**
 * The quiet "no Flyover here" line under the country. It opens up with a
 * spring, so the card grows smoothly instead of jumping (at once under
 * Reduce Motion). The inner view measures the text; the outer one shows
 * `measured height × progress` of it.
 */
export function TerrainNote() {
  const reduceMotion = useReduceMotion();
  const measured = useSharedValue(0);
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.set(reduceMotion ? 1 : withSpring(1, springConfig(springs.gentle, reduceMotion)));
  }, [reduceMotion, progress]);

  const revealStyle = useAnimatedStyle(() => ({
    height: measured.get() * progress.get(),
    opacity: progress.get(),
  }));

  const onLayout = (event: LayoutChangeEvent) => measured.set(event.nativeEvent.layout.height);

  return (
    <Animated.View style={[styles.clip, revealStyle]}>
      <View onLayout={onLayout} style={styles.content}>
        <Text variant="footnote" color="secondaryLabel">
          {TERRAIN_NOTE}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  content: { paddingTop: spacing.sm },
});
