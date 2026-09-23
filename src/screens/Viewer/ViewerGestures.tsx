import type { ReactNode } from 'react';
import { StyleSheet, View, type AccessibilityActionEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

/** How long to hold anywhere to leave the diorama. */
export const EXIT_HOLD_MS = 1000;

/**
 * How far (in points) a held finger may drift and still count as holding
 * still. A phone held in one hand, or pressed into a headset, moves a
 * little; a long press's own allowance (10 pt) gives up too easily.
 */
export const EXIT_HOLD_DRIFT = 30;

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
  /** A single tap anywhere, once it's clear it isn't the start of a double-tap. */
  onTap: () => void;
  onRecenter: () => void;
  onExit: () => void;
  /** What VoiceOver calls the whole view. */
  accessibilityLabel: string;
};

/**
 * The whole screen is the control, since nothing can be aimed at once it's
 * worn: double-tap anywhere recenters, hold anywhere for a second to exit,
 * and a single tap (for the exit button in mono) comes last. The recognizers
 * sit on this container, not on a layer over the map, so the map's own
 * drag-to-look (debug look) still gets every drag.
 */
export function ViewerGestures({
  children,
  onTap,
  onRecenter,
  onExit,
  accessibilityLabel,
}: ViewerGesturesProps) {
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .runOnJS(true)
    .onStart(() => onRecenter())
    .withTestId('viewer-double-tap');
  const tap = Gesture.Tap()
    .runOnJS(true)
    .onStart(() => onTap())
    .withTestId('viewer-tap');
  const hold = Gesture.LongPress()
    .minDuration(EXIT_HOLD_MS)
    .maxDistance(EXIT_HOLD_DRIFT)
    .runOnJS(true)
    .onStart(() => onExit())
    .withTestId('viewer-long-press');
  // Each waits for the ones before it to fail. A double-tap never waits;
  // a single tap waits out the double-tap window; a hold waits for both
  // taps, which give up half a second into it, well before the second is up.
  const gesture = Gesture.Exclusive(doubleTap, tap, hold);

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
