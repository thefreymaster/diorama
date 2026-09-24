import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { colors, MAX_GLYPH_SCALE, spacing, springConfig, springs, useScaledSize } from '@/theme';

import { SymbolIcon } from './SymbolIcon';
import { Text } from './Text';

/** How wide the action is when the row rests open, at the default text size. */
const ACTION_WIDTH = 76;

/** A swipe past this share of the row's width deletes on release (a "full swipe"). */
const FULL_SWIPE_FRACTION = 0.55;

/** However narrow the row, a full swipe goes at least this far past the open action. */
const FULL_SWIPE_MIN_EXTRA = 48;

/** How the label jumps between the action's trailing end and its leading edge. */
const LEADING_SPRING = springConfig(springs.press, false);

/** True when a swipe that has uncovered `revealed` points of a `rowWidth` row deletes on release. */
export function isFullSwipe(revealed: number, rowWidth: number, actionWidth: number): boolean {
  'worklet';
  if (rowWidth <= 0) return false;
  return revealed > Math.max(actionWidth + FULL_SWIPE_MIN_EXTRA, rowWidth * FULL_SWIPE_FRACTION);
}

type SwipeDeleteActionProps = {
  /** How far the row's content has moved: negative while swiped left (the swipeable's own value). */
  translation: SharedValue<number>;
  /** The row's width in points. */
  rowWidth: SharedValue<number>;
  /** 0 to 1 as the row's content slides away after a delete. */
  slide: SharedValue<number>;
  /** The swipe crossed into (true) or back out of (false) a full swipe. */
  onFullSwipeChange: (reached: boolean) => void;
  onPress: () => void;
};

/**
 * The red Delete action under a row that's swiped left, as in Mail. Rendered
 * by `ReanimatedSwipeable` (a native pan gesture moves the row; this runs on
 * the UI thread, frame by frame, without React re-rendering). The red fills
 * exactly the gap the row leaves; the glyph and label sit centered in it,
 * then ride its trailing edge, and jump to its leading edge, beside the row,
 * once a full swipe would delete.
 *
 * VoiceOver skips it: the row itself offers a "Delete" action instead.
 */
export function SwipeDeleteAction({
  translation,
  rowWidth,
  slide,
  onFullSwipeChange,
  onPress,
}: SwipeDeleteActionProps) {
  const actionWidth = useScaledSize(ACTION_WIDTH);
  // 0 to 1 as the label moves to the leading edge for a full swipe.
  const leading = useSharedValue(0);

  // Watches the swipe on the UI thread; tells React only when it crosses the line.
  useAnimatedReaction(
    () => isFullSwipe(-translation.get(), rowWidth.get(), actionWidth),
    (reached, previous) => {
      if (previous === null || reached === previous) return;
      // Worklets can only use plain values from outside: the config is built above, in JS.
      leading.set(withSpring(reached ? 1 : 0, LEADING_SPRING));
      scheduleOnRN(onFullSwipeChange, reached);
    },
  );

  // The red's width: the gap the swipe opened, growing to the whole row as it slides away.
  const fillWidth = useDerivedValue(() => {
    const width = rowWidth.get();
    return Math.min(width, Math.max(0, -translation.get()) + slide.get() * width);
  });

  const fillStyle = useAnimatedStyle(() => ({ width: fillWidth.get() }));

  const labelStyle = useAnimatedStyle(() => {
    const fill = fillWidth.get();
    // Centered while the red is narrower than the action, then kept at its trailing end.
    const resting = fill <= actionWidth ? (fill - actionWidth) / 2 : fill - actionWidth;
    const toLeading = Math.max(leading.get(), slide.get());
    return { transform: [{ translateX: resting * (1 - toLeading) }] };
  });

  return (
    <>
      {/* Sets how far the row opens: the swipeable measures its actions' width. */}
      <View style={{ width: actionWidth }} />
      <Animated.View
        style={[styles.fill, fillStyle]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Pressable testID="swipe-delete-action" onPress={onPress} style={StyleSheet.absoluteFill}>
          <Animated.View style={[styles.label, { width: actionWidth }, labelStyle]}>
            <SymbolIcon name="trash" size={18} weight="medium" color="onTint" />
            <Text
              variant="footnote"
              emphasized
              color="onTint"
              numberOfLines={1}
              maxFontSizeMultiplier={MAX_GLYPH_SCALE}
            >
              Delete
            </Text>
          </Animated.View>
        </Pressable>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  fill: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    backgroundColor: colors.systemRed,
  },
  label: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
});
