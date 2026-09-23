import { PlatformColor, ScrollView, StyleSheet, Text } from 'react-native';

import { useSettings } from '@/features/settings/store';

/** Placeholder until T13 builds the settings list. Shows the stored values. */
export function SettingsScreen() {
  const settings = useSettings();

  return (
    <ScrollView
      testID="settings-screen"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
    >
      <Text style={styles.row}>Model size: {settings.eyeSeparation.toFixed(1)}</Text>
      <Text style={styles.row}>
        Tracking sensitivity: {settings.trackingSensitivity.toFixed(1)}
      </Text>
      <Text style={styles.row}>Miniature effect: {settings.miniatureIntensity.toFixed(1)}</Text>
      <Text style={styles.row}>Stereo: {settings.mode === 'stereo' ? 'On' : 'Off'}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 12,
  },
  row: {
    color: PlatformColor('label'),
  },
});
