import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { springConfig, springs, useReduceMotion } from '@/theme';

type SpringRevealProps = {
  children: ReactNode;
  /** Space above the content, inside the reveal (so it opens up too). */
  paddingTop: number;
  /** On the outer view, whose height grows. */
  testID?: string;
  /** On the inner view, which holds the content at full size. */
  contentTestID?: string;
};

/**
 * Something new in the preview card that opens up with a spring when it
 * appears, so the card grows smoothly instead of jumping (at once under
 * Reduce Motion). The inner view measures the content; the outer one shows
 * `measured height × progress` of it. The inner view is laid out on its
 * own (absolutely), so the outer one's height, which starts at 0, can't
 * squash what it's measuring.
 */
export function SpringReveal({ children, paddingTop, testID, contentTestID }: SpringRevealProps) {
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
    <Animated.View testID={testID} style={[styles.clip, revealStyle]}>
      <View testID={contentTestID} onLayout={onLayout} style={[styles.content, { paddingTop }]}>
        {children}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  content: { position: 'absolute', top: 0, left: 0, right: 0 },
});
