import { useSetting } from '@/features/settings/store';

import { sliderConfig, type SliderSetting } from './sliderSettings';

/**
 * One setting as a 0…1 slider. Moving the thumb writes to the store at once
 * (which saves it), so the preview and the Viewer follow along live. The
 * native slider ignores `position` while a finger is on it, so writing on
 * every move never fights the drag.
 */
export function useSettingSlider(setting: SliderSetting) {
  const { scale, set, stereoOnly = false } = sliderConfig(setting);
  const value = useSetting(setting);
  const mode = useSetting('mode');

  return {
    value,
    position: scale.toPosition(value),
    disabled: stereoOnly && mode === 'mono',
    onChange: (position: number) => set(scale.fromPosition(position)),
  };
}
