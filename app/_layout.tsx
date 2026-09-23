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
      {/* Portrait everywhere; only the Viewer route below also turns sideways. */}
      <Stack
        screenOptions={{
          orientation: 'portrait',
          // Despite the name, this drops the hairline from the bar's scroll-edge
          // appearance on every screen, large title or not: no line at rest, and
          // it still appears once content scrolls under the bar, like UIKit.
          headerLargeTitleShadowVisible: false,
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Diorama', headerLargeTitleEnabled: true }} />
        <Stack.Screen name="city/[cityId]" options={{ title: '' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        <Stack.Screen
          name="view/[cityId]"
          options={{
            presentation: 'fullScreenModal',
            headerShown: false,
            // Every way but upside down: upright is full screen, sideways the
            // two-eye view. Leaving it, the preview turns the phone back upright.
            orientation: 'default',
            autoHideHomeIndicator: true,
          }}
        />
      </Stack>
    </AppProviders>
  );
}
