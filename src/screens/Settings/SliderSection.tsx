import { InsetGroupedSection } from '@/ui';

import { SettingSlider } from './SettingSlider';
import { SLIDER_SETTINGS, type SliderSetting } from './sliderSettings';

/** A section with one slider: the setting's name above, what it does below. */
export function SliderSection({ setting }: { setting: SliderSetting }) {
  const { title, footer } = SLIDER_SETTINGS[setting];

  return (
    <InsetGroupedSection title={title} footer={footer}>
      <SettingSlider setting={setting} />
    </InsetGroupedSection>
  );
}
