import { Switch } from 'react-native';

import { ControlRow } from './ControlRow';
import { rowStyles } from './rowStyles';
import { Text } from './Text';

export type ToggleRowProps = {
  title: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  /** Put on the switch itself. */
  testID?: string;
  /**
   * Dims the row and locks the switch, like a setting that only matters
   * while another one is on. VoiceOver reads it as dimmed.
   */
  disabled?: boolean;
};

/**
 * A list row with a native switch (UISwitch) at the trailing edge. As in
 * Settings, only the switch reacts to touch, and VoiceOver reads the whole
 * row as one switch ("Stereo, switch, on") that a double-tap flips. The
 * title wraps at large text sizes; the switch stays put.
 */
export function ToggleRow({
  title,
  value,
  onValueChange,
  testID,
  disabled = false,
}: ToggleRowProps) {
  return (
    <ControlRow
      accessible
      accessibilityRole="switch"
      accessibilityLabel={title}
      accessibilityState={{ checked: value, disabled }}
      onAccessibilityTap={disabled ? undefined : () => onValueChange(!value)}
    >
      <Text style={rowStyles.text} color={disabled ? 'tertiaryLabel' : 'label'}>
        {title}
      </Text>
      <Switch testID={testID} value={value} onValueChange={onValueChange} disabled={disabled} />
    </ControlRow>
  );
}
