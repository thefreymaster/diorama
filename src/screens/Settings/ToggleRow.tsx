import { Switch, View } from 'react-native';

import { Text } from '@/ui';
import { RowSeparator } from '@/ui/RowSeparator';
import { rowStyles } from '@/ui/rowStyles';

type ToggleRowProps = {
  title: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  testID?: string;
};

/**
 * A list row with a native switch (UISwitch) at the trailing edge. As in
 * Settings, only the switch reacts to touch, and VoiceOver reads the whole
 * row as one switch ("Stereo, switch, on") that a double-tap flips.
 */
export function ToggleRow({ title, value, onValueChange, testID }: ToggleRowProps) {
  return (
    <View
      style={[rowStyles.row, rowStyles.textOnly]}
      accessible
      accessibilityRole="switch"
      accessibilityLabel={title}
      accessibilityState={{ checked: value }}
      onAccessibilityTap={() => onValueChange(!value)}
    >
      <View style={rowStyles.content}>
        <RowSeparator />
        <Text style={rowStyles.text}>{title}</Text>
        <Switch testID={testID} value={value} onValueChange={onValueChange} />
      </View>
    </View>
  );
}
