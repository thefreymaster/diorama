import { Link } from 'expo-router';
import { PlatformColor, ScrollView, StyleSheet, Text } from 'react-native';

/** Placeholder until T10 builds the real picker (search, recents, featured cities). */
export function CityPickerScreen() {
  return (
    <ScrollView
      testID="city-picker-screen"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
    >
      <Text style={styles.body}>Tiny model cities, in stereo.</Text>
      <Link href="/city/paris" style={styles.link}>
        Paris
      </Link>
      <Link href="/settings" style={styles.link}>
        Settings
      </Link>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 16,
  },
  body: {
    color: PlatformColor('secondaryLabel'),
  },
  link: {
    color: PlatformColor('link'),
  },
});
