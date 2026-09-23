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
 * `measured height × progress` of it. The inner view is laid out on its own
 * (absolutely), so the outer one's height, which starts at 0, can't squash
 * the text it's measuring.
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
    <Animated.View testID="terrain-note" style={[styles.clip, revealStyle]}>
      <View testID="terrain-note-text" onLayout={onLayout} style={styles.content}>
        <Text variant="footnote" color="secondaryLabel">
          {TERRAIN_NOTE}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  content: { position: 'absolute', top: 0, left: 0, right: 0, paddingTop: spacing.sm },
});
