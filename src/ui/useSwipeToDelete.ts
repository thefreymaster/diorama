import { useEffect, useId, useRef, useState, type RefObject } from 'react';
import type { AccessibilityActionEvent, LayoutChangeEvent } from 'react-native';
import type { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { springConfig, springs, useReduceMotion } from '@/theme';

import { actionHaptic, selectionHaptic } from './haptics';
import {
  swipeRowDidClose,
  swipeRowTouched,
  swipeRowWillOpen,
  tapClosesOpenSwipeRow,
} from './openSwipeRow';

/** The row's VoiceOver actions (swipe up or down to pick one): just "Delete". */
export const DELETE_ACCESSIBILITY_ACTIONS = [{ name: 'delete', label: 'Delete' }];

// A deleted row leaves in one spring from 0 to 1: its content slides out
// over the first part, and it closes up from a little before that ends.
const SLIDE_END = 0.45;
const COLLAPSE_START = 0.3;

/**
 * Everything a `SwipeToDeleteRow` does besides drawing: tracks the swipe,
 * keeps it the only open row, and deletes (from the Delete action, a full
 * swipe, or VoiceOver) with a light tap and a spring that slides the row out
 * and closes the gap. Under Reduce Motion the row fades out instead.
 * `onDelete` runs once the row is gone from view, and must remove it.
 * `swipeable` is the row's `ReanimatedSwipeable` ref, so it can be closed.
 */
export function useSwipeToDelete(
  onDelete: () => void,
  swipeable: RefObject<SwipeableMethods | null>,
) {
  const id = useId();
  const reduceMotion = useReduceMotion();
  const [isDeleting, setIsDeleting] = useState(false);
  const deleting = useRef(false);
  const fullSwipe = useRef(false);

  // Shared values live on the UI thread too, so animations read them each frame.
  const rowWidth = useSharedValue(0);
  const rowHeight = useSharedValue(0);
  const leaving = useSharedValue(0);
  const slide = useDerivedValue(() =>
    reduceMotion ? 0 : interpolate(leaving.get(), [0, SLIDE_END], [0, 1], Extrapolation.CLAMP),
  );

  // A row that goes away (deleted, or the list changed) is no longer open.
  useEffect(() => () => swipeRowDidClose(id), [id]);

  const remove = () => {
    if (deleting.current) return;
    deleting.current = true;
    setIsDeleting(true);
    swipeRowDidClose(id);
    actionHaptic();
    leaving.set(
      withSpring(1, springConfig(springs.gentle, reduceMotion), () => {
        scheduleOnRN(onDelete);
      }),
    );
  };

  const close = () => swipeable.current?.close();

  const rowStyle = useAnimatedStyle(() => {
    const progress = leaving.get();
    if (progress === 0) return {};
    if (reduceMotion) return { opacity: 1 - Math.min(progress, 1) };
    const collapse = interpolate(progress, [COLLAPSE_START, 1], [0, 1], Extrapolation.CLAMP);
    return { height: rowHeight.get() * (1 - collapse) };
  });

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -slide.get() * rowWidth.get() }],
  }));

  return {
    isDeleting,
    rowStyle,
    contentStyle,
    /** For `SwipeDeleteAction`. */
    action: {
      rowWidth,
      slide,
      onPress: remove,
      onFullSwipeChange: (reached: boolean) => {
        if (deleting.current) return;
        fullSwipe.current = reached;
        // A tick as the swipe crosses into "release to delete", like Mail.
        if (reached) selectionHaptic();
      },
    },
    onLayout: ({ nativeEvent: { layout } }: LayoutChangeEvent) => {
      // While the row closes up, its shrinking height isn't its size.
      if (deleting.current) return;
      rowWidth.set(layout.width);
      rowHeight.set(layout.height);
    },
    onTouchStart: () => swipeRowTouched(id),
    onOpenStartDrag: () => swipeRowWillOpen(id, close),
    onWillOpen: () => {
      // Let go past the full-swipe line: delete, as if Delete were tapped.
      if (fullSwipe.current) remove();
      else swipeRowWillOpen(id, close);
    },
    onWillClose: () => swipeRowDidClose(id),
    onAccessibilityAction: (event: AccessibilityActionEvent) => {
      if (event.nativeEvent.actionName === 'delete') remove();
    },
    /** Wraps the row's tap: a tap that closes an open row does nothing else. */
    tap: (onPress: () => void) => () => {
      if (deleting.current || tapClosesOpenSwipeRow()) return;
      onPress();
    },
  };
}
