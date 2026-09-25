import { useSetting } from '@/features/settings/store';

import { sliderConfig, type SliderSetting, type SliderSwitch } from './sliderSettings';

/**
 * One setting as a 0…1 slider. Moving the thumb writes to the store at once
 * (which saves it), so the preview and the Viewer follow along live. The
 * native slider ignores `position` while a finger is on it, so writing on
 * every move never fights the drag. A slider that belongs to a switch (the
 * two-eye view, lean to move closer) dims while it's off, since then the
 * Viewer never uses it.
 */
export function useSettingSlider(setting: SliderSetting) {
  const { scale, set, requires } = sliderConfig(setting);
  const value = useSetting(setting);
  const switches: Record<SliderSwitch, boolean> = {
    twoEyeLandscape: useSetting('twoEyeLandscape'),
    headPosition: useSetting('headPosition'),
  };

  return {
    value,
    position: scale.toPosition(value),
    disabled: requires !== undefined && !switches[requires],
    onChange: (position: number) => set(scale.fromPosition(position)),
  };
}
