import { Stack } from 'expo-router';
import { View } from 'react-native';

import { Screen } from '@/ui';

import { DeveloperSection } from './DeveloperSection';
import { MiniatureSection } from './MiniatureSection';
import { ResetSection } from './ResetSection';
import { SliderSection } from './SliderSection';
import { StereoSection } from './StereoSection';

/**
 * How the diorama looks and moves, as an inset-grouped list under a large
 * title. Every control writes to the settings store as it moves; the store
 * saves itself, and the Viewer reads the same store.
 */
export function SettingsScreen() {
  return (
    <Screen background="grouped">
      <Stack.Screen options={{ headerLargeTitleEnabled: true }} />
      <View testID="settings-screen">
        <MiniatureSection />
        <StereoSection />
        <SliderSection setting="eyeSeparation" />
        <SliderSection setting="trackingSensitivity" />
        <DeveloperSection />
        <ResetSection />
      </View>
    </Screen>
  );
}
