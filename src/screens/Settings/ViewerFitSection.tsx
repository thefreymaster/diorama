import { InsetGroupedSection } from '@/ui';

import { FitSliderRow } from './FitSliderRow';

/**
 * Where each eye's round picture sits behind the headset's lenses, and how
 * big it is, in millimeters, so a viewer can be matched on the phone. It
 * only matters in the two-eye view, so it dims while that's off, like Model
 * size.
 */
export function ViewerFitSection() {
  return (
    <InsetGroupedSection title="Viewer fit" footer="Match the circles to your viewer's lenses.">
      <FitSliderRow setting="lensSpacing" />
      <FitSliderRow setting="windowDiameter" />
    </InsetGroupedSection>
  );
}
