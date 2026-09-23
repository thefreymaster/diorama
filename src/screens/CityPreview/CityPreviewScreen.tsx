import { Link, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme';

/** Placeholder until T11 adds the orbiting 3D preview. */
export function CityPreviewScreen() {
  const { cityId } = useLocalSearchParams<'/city/[cityId]'>();

  return (
    <View testID="city-preview-screen" style={styles.container}>
      <Text style={styles.title}>{cityId}</Text>
      <Link href={{ pathname: '/view/[cityId]', params: { cityId } }} style={styles.link}>
        Enter Diorama
      </Link>
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
