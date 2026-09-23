import * as Haptics from 'expo-haptics';

// The app's three kinds of tap feedback. Every call site picks by what the
// action *is*, so the same kind of action feels the same everywhere.

/** Picking something from a list, like a city row: UIKit's light selection tick. */
export function selectionHaptic(): void {
  void Haptics.selectionAsync();
}

/** Doing something: a screen's main button, recentering, resetting settings. */
export function actionHaptic(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

/** Leaving the diorama: firmer, since the wearer can't see the screen change. */
export function exitHaptic(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}
