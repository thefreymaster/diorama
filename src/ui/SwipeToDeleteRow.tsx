import { useRef } from 'react';
import { StyleSheet } from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated from 'react-native-reanimated';

import { springConfig, springs } from '@/theme';

import { ListRow, type ListRowProps } from './ListRow';
import { SwipeDeleteAction } from './SwipeDeleteAction';
import { DELETE_ACCESSIBILITY_ACTIONS, useSwipeToDelete } from './useSwipeToDelete';

export type SwipeToDeleteRowProps = ListRowProps & {
  /** Removes the row's item. Runs once the row has animated away, and must remove the row. */
  onDelete: () => void;
};

/**
 * A `ListRow` that deletes with the standard iOS swipe: swipe left to show a
 * red Delete action and tap it, or swipe all the way to delete at once.
 * VoiceOver offers "Delete" as an action on the row. Only one row is open at
 * a time; scrolling or touching anywhere else closes it. Place inside
 * `InsetGroupedSection`: the card's rounded corners clip the red, like Settings.
 */
export function SwipeToDeleteRow({ onDelete, onPress, ...row }: SwipeToDeleteRowProps) {
  const swipeable = useRef<SwipeableMethods>(null);
  const swipe = useSwipeToDelete(onDelete, swipeable);

  return (
    <Animated.View
      testID="swipe-row"
      style={[styles.row, swipe.rowStyle]}
      onLayout={swipe.onLayout}
      onTouchStart={swipe.onTouchStart}
    >
      <ReanimatedSwipeable
        ref={swipeable}
        enabled={!swipe.isDeleting}
        animationOptions={SETTLE_SPRING}
        onSwipeableOpenStartDrag={swipe.onOpenStartDrag}
        onSwipeableWillOpen={swipe.onWillOpen}
        onSwipeableWillClose={swipe.onWillClose}
        renderRightActions={(_progress, translation) => (
          <SwipeDeleteAction translation={translation} {...swipe.action} />
        )}
      >
        <Animated.View style={swipe.contentStyle}>
          <ListRow
            {...row}
            onPress={onPress && swipe.tap(onPress)}
            accessibilityActions={DELETE_ACCESSIBILITY_ACTIONS}
            onAccessibilityAction={swipe.onAccessibilityAction}
          />
        </Animated.View>
      </ReanimatedSwipeable>
    </Animated.View>
  );
}

/** The row settles open or shut without a bounce, as UIKit's does. */
const SETTLE_SPRING = springConfig(springs.gentle, true);

const styles = StyleSheet.create({
  // Clips the row while it closes up after a delete.
  row: { overflow: 'hidden' },
});
