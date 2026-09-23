import { useSetting } from '@/features/settings/store';

import { sliderConfig, type SliderSetting } from './sliderSettings';

/**
 * One setting as a 0…1 slider. Moving the thumb writes to the store at once
 * (which saves it), so the preview and the Viewer follow along live. The
 * native slider ignores `position` while a finger is on it, so writing on
 * every move never fights the drag. Sliders for the two-eye view dim while
 * it's off, since then the Viewer never shows it.
 */
export function useSettingSlider(setting: SliderSetting) {
  const { scale, set, stereoOnly = false } = sliderConfig(setting);
  const value = useSetting(setting);
  const twoEyeLandscape = useSetting('twoEyeLandscape');

  return {
    value,
    position: scale.toPosition(value),
    disabled: stereoOnly && !twoEyeLandscape,
    onChange: (position: number) => set(scale.fromPosition(position)),
  };
}
