import { InsetGroupedSection } from '@/ui';

import { SettingSlider } from './SettingSlider';
import { SettingsPreviewMap } from './SettingsPreviewMap';
import { SLIDER_SETTINGS } from './sliderSettings';

/**
 * The top card: a live preview of the city with its slider right under it,
 * in one card, like Appearance in Display & Brightness.
 */
export function MiniatureSection() {
  const { title, footer } = SLIDER_SETTINGS.miniatureIntensity;

  return (
    <InsetGroupedSection title={title} footer={footer}>
      <SettingsPreviewMap />
      <SettingSlider setting="miniatureIntensity" />
    </InsetGroupedSection>
  );
}
