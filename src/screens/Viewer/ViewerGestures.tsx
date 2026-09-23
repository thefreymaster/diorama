import type { ReactNode } from 'react';
import { StyleSheet, View, type AccessibilityActionEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

/** How long to hold anywhere to leave the diorama. */
export const EXIT_HOLD_MS = 1000;

/** What VoiceOver says a double-tap on the view does. */
export const VIEWER_ACCESSIBILITY_HINT = "Recenters the view on where you're facing.";

// VoiceOver: double-tap (activate) recenters, like a double-tap without it;
// the rotor offers Recenter and Exit, and the two-finger scrub (escape) exits.
const ACCESSIBILITY_ACTIONS = [
  { name: 'activate', label: 'Recenter' },
  { name: 'recenter', label: 'Recenter' },
  { name: 'exit', label: 'Exit' },
  { name: 'escape', label: 'Exit' },
];

type ViewerGesturesProps = {
  children: ReactNode;
  onRecenter: () => void;
  onExit: () => void;
  /** What VoiceOver calls the whole view. */
  accessibilityLabel: string;
};

/**
 * The whole screen is the control, since nothing can be aimed at once it's
 * worn: double-tap anywhere recenters, hold anywhere for a second to exit.
 * The recognizers sit on this container, not on a layer over the map, so
 * the map's own drag-to-look (debug look) still gets every drag.
 */
export function ViewerGestures({
  children,
  onRecenter,
  onExit,
  accessibilityLabel,
}: ViewerGesturesProps) {
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .runOnJS(true)
    .onStart(() => onRecenter())
    .withTestId('viewer-double-tap');
  const hold = Gesture.LongPress()
    .minDuration(EXIT_HOLD_MS)
    .runOnJS(true)
    .onStart(() => onExit())
    .withTestId('viewer-long-press');
  // A double-tap wins over the start of a hold.
  const gesture = Gesture.Exclusive(doubleTap, hold);

  const onAccessibilityAction = ({ nativeEvent }: AccessibilityActionEvent) => {
    switch (nativeEvent.actionName) {
      case 'activate':
      case 'recenter':
        onRecenter();
        break;
      case 'exit':
      case 'escape':
        onExit();
        break;
    }
  };

  return (
    <GestureDetector gesture={gesture}>
      <View
        testID="viewer-screen"
        style={styles.fill}
        accessible
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={VIEWER_ACCESSIBILITY_HINT}
        accessibilityActions={ACCESSIBILITY_ACTIONS}
        onAccessibilityAction={onAccessibilityAction}
      >
        {children}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
