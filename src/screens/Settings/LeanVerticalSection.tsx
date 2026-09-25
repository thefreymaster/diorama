import { setLeanVertical, useSetting } from '@/features/settings/store';
import { InsetGroupedSection, ToggleRow } from '@/ui';

export const LEAN_VERTICAL_TITLE = 'Move up and down';
export const LEAN_VERTICAL_FOOTER =
  'Standing up or sitting down raises or lowers you over the city. Turn it off to keep your height as you lean.';

/**
 * Whether leaning moves you up and down as well: off, standing up, sitting
 * down or bobbing leaves your height over the city alone, and only leaning
 * forward and sideways moves you. It belongs to "Lean to move closer", so it
 * dims while that's off, like Lean distance.
 */
export function LeanVerticalSection() {
  const leanOn = useSetting('headPosition');
  const vertical = useSetting('leanVertical');

  return (
    <InsetGroupedSection footer={LEAN_VERTICAL_FOOTER}>
      <ToggleRow
        title={LEAN_VERTICAL_TITLE}
        testID="lean-vertical-switch"
        value={vertical}
        onValueChange={setLeanVertical}
        disabled={!leanOn}
      />
    </InsetGroupedSection>
  );
}
