import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';
import { GlassButton } from '@/ui';

/**
 * A round glass ✕ in the sheet's top corner, as iOS 26 sheets have: the
 * same as swiping the sheet down, for anyone who can't (VoiceOver).
 */
export function PickerCloseButton() {
  const router = useRouter();

  return (
    <View style={styles.corner}>
      <GlassButton symbol="xmark" accessibilityLabel="Close" onPress={() => router.back()} />
    </View>
  );
}

const styles = StyleSheet.create({
  corner: { position: 'absolute', top: spacing.lg, left: spacing.lg },
});
