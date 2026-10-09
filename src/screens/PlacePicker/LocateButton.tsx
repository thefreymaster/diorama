import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';
import { GlassButton } from '@/ui';

type LocateButtonProps = {
  /** The pin is on you: the arrow is filled, as in Apple Maps. */
  onYou: boolean;
  /** Location access is off, so a tap opens Settings. */
  accessOff: boolean;
  onPress: () => void;
};

/**
 * "Show my location": a round glass arrow in the sheet's top-right corner,
 * across from the ✕, like Apple Maps' location button.
 */
export function LocateButton({ onYou, accessOff, onPress }: LocateButtonProps) {
  return (
    <View style={styles.corner}>
      <GlassButton
        symbol={onYou ? 'location.fill' : 'location'}
        accessibilityLabel="Show my location"
        accessibilityHint={accessOff ? 'Opens Settings.' : undefined}
        onPress={onPress}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  corner: { position: 'absolute', top: spacing.lg, right: spacing.lg },
});
