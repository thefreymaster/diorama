import { Pressable, View } from 'react-native';

import { InsetGroupedSection, Text } from '@/ui';
import { rowStyles } from '@/ui/rowStyles';

import { useResetSettings } from './useResetSettings';

/** A red "Reset to defaults" row, like the reset rows in Settings. */
export function ResetSection() {
  const reset = useResetSettings();

  return (
    <InsetGroupedSection>
      <Pressable
        onPress={reset}
        accessibilityRole="button"
        accessibilityHint="Puts every setting on this screen back the way it started."
        style={({ pressed }) => [rowStyles.row, rowStyles.textOnly, pressed && rowStyles.pressed]}
      >
        <View style={rowStyles.content}>
          <Text color="systemRed" style={rowStyles.text}>
            Reset to defaults
          </Text>
        </View>
      </Pressable>
    </InsetGroupedSection>
  );
}
