import { Stack } from 'expo-router';
import { PlatformColor, StyleSheet, Text, View } from 'react-native';

// Placeholder until T03 swaps this for the CityPicker screen.
export default function Index() {
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Diorama' }} />
      <Text style={styles.body}>Tiny model cities, in stereo.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PlatformColor('systemBackground'),
  },
  body: {
    color: PlatformColor('secondaryLabel'),
  },
});
