import { Stack } from 'expo-router';

import { AppProviders } from '@/providers/AppProviders';

// Deep links such as diorama://settings open on top of the picker,
// so there is always a screen to swipe back to.
export const unstable_settings = {
  initialRouteName: 'index',
};

export default function RootLayout() {
  return (
    <AppProviders>
      {/* Portrait everywhere; the Viewer route below is the only landscape screen. */}
      <Stack screenOptions={{ orientation: 'portrait' }}>
        <Stack.Screen name="index" options={{ title: 'Diorama', headerLargeTitleEnabled: true }} />
        <Stack.Screen name="city/[cityId]" options={{ title: '' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        <Stack.Screen
          name="view/[cityId]"
          options={{
            presentation: 'fullScreenModal',
            headerShown: false,
            orientation: 'landscape',
            autoHideHomeIndicator: true,
          }}
        />
      </Stack>
    </AppProviders>
  );
}
