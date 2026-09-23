import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme';

/**
 * Placeholder until T12 adds the stereo viewer. The Done button stands in for
 * the long-press exit, since a full-screen modal has no swipe to dismiss.
 */
export function ViewerScreen() {
  const { cityId } = useLocalSearchParams<'/view/[cityId]'>();
  const router = useRouter();

  const exit = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <View testID="viewer-screen" style={styles.container}>
      <Text style={styles.title}>Viewer: {cityId}</Text>
      <Pressable accessibilityRole="button" onPress={exit} hitSlop={12}>
        <Text style={styles.link}>Done</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  title: {
    color: colors.label,
  },
  link: {
    color: colors.tint,
  },
});
