import { setTwoEyeLandscape, useSetting } from '@/features/settings/store';
import { InsetGroupedSection, ToggleRow } from '@/ui';

/** Whether turning the phone sideways in the Viewer gives the headset's two-eye view. */
export function TwoEyeSection() {
  const twoEyeLandscape = useSetting('twoEyeLandscape');

  return (
    <InsetGroupedSection footer="Shows a picture for each eye when your iPhone is sideways, for a headset viewer. Upright, the city always fills the screen.">
      <ToggleRow
        title="Two-eye view in landscape"
        testID="two-eye-switch"
        value={twoEyeLandscape}
        onValueChange={setTwoEyeLandscape}
      />
    </InsetGroupedSection>
  );
}
