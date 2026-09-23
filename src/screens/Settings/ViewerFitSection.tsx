import { InsetGroupedSection } from '@/ui';

import { FitSliderRow } from './FitSliderRow';

/**
 * Where each eye's picture sits behind the headset's lenses, in
 * millimeters, so a viewer can be matched on the phone. It only matters in
 * stereo, so it dims in mono, like Model size.
 */
export function ViewerFitSection() {
  return (
    <InsetGroupedSection title="Viewer fit" footer="Match the windows to your viewer's lenses.">
      <FitSliderRow setting="lensSpacing" />
      <FitSliderRow setting="windowWidth" />
      <FitSliderRow setting="windowHeight" />
    </InsetGroupedSection>
  );
}
