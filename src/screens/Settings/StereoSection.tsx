import { setMode, useSetting } from '@/features/settings/store';
import { InsetGroupedSection, ToggleRow } from '@/ui';

/** Stereo (a picture per eye, for a headset) or mono (one picture). */
export function StereoSection() {
  const mode = useSetting('mode');

  return (
    <InsetGroupedSection footer="Shows a picture for each eye, side by side, for a headset viewer. Turn off to see one picture.">
      <ToggleRow
        title="Stereo"
        testID="stereo-switch"
        value={mode === 'stereo'}
        onValueChange={(on) => setMode(on ? 'stereo' : 'mono')}
      />
    </InsetGroupedSection>
  );
}
