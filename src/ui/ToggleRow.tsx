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
};

/**
 * A list row with a native switch (UISwitch) at the trailing edge. As in
 * Settings, only the switch reacts to touch, and VoiceOver reads the whole
 * row as one switch ("Stereo, switch, on") that a double-tap flips. The
 * title wraps at large text sizes; the switch stays put.
 */
export function ToggleRow({ title, value, onValueChange, testID }: ToggleRowProps) {
  return (
    <ControlRow
      accessible
      accessibilityRole="switch"
      accessibilityLabel={title}
      accessibilityState={{ checked: value }}
      onAccessibilityTap={() => onValueChange(!value)}
    >
      <Text style={rowStyles.text}>{title}</Text>
      <Switch testID={testID} value={value} onValueChange={onValueChange} />
    </ControlRow>
  );
}
