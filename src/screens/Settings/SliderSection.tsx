import { InsetGroupedSection } from '@/ui';

import { SettingSlider } from './SettingSlider';
import { SLIDER_SETTINGS, type GlyphSliderSetting } from './sliderSettings';

/** A section with one slider: the setting's name above, what it does below. */
export function SliderSection({ setting }: { setting: GlyphSliderSetting }) {
  const { title, footer } = SLIDER_SETTINGS[setting];

  return (
    <InsetGroupedSection title={title} footer={footer}>
      <SettingSlider setting={setting} />
    </InsetGroupedSection>
  );
}
