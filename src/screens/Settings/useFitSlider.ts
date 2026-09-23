import type { AccessibilityActionEvent, AccessibilityActionInfo } from 'react-native';

import { FIT_SETTINGS, type FitSetting } from './sliderSettings';
import { useSettingSlider } from './useSettingSlider';

/** VoiceOver's swipe up and down on an adjustable row. */
export const ADJUST_ACTIONS: readonly AccessibilityActionInfo[] = [
  { name: 'increment' },
  { name: 'decrement' },
];

/** Tenths at most, so a whole millimeter reads "64" rather than "64.0". */
function millimeters(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * One "Viewer fit" size as a slider that snaps to whole millimeters, with
 * its value written out ("64 mm" on screen, "64 millimeters" for
 * VoiceOver). A swipe up or down with VoiceOver moves it one millimeter.
 * Like every slider here it writes to the store as it moves, so the Viewer
 * follows along live.
 */
export function useFitSlider(setting: FitSetting) {
  const { scale, set } = FIT_SETTINGS[setting];
  const slider = useSettingSlider(setting);
  const shown = millimeters(slider.value);

  const nudge = (steps: number) => {
    if (slider.disabled) return;
    set(scale.fromPosition(slider.position + steps * scale.positionStep));
  };

  return {
    ...slider,
    positionStep: scale.positionStep,
    valueText: `${shown} mm`,
    spokenValue: `${shown} ${shown === 1 ? 'millimeter' : 'millimeters'}`,
    onAccessibilityAction: ({ nativeEvent }: AccessibilityActionEvent) => {
      if (nativeEvent.actionName === 'increment') nudge(1);
      if (nativeEvent.actionName === 'decrement') nudge(-1);
    },
  };
}
