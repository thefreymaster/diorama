import { Stack } from 'expo-router';

import { AppProviders } from '@/providers/AppProviders';
import { useHideSplashScreen } from '@/providers/useHideSplashScreen';

// Deep links such as diorama://settings open on top of the picker,
// so there is always a screen to swipe back to.
export const unstable_settings = {
  initialRouteName: 'index',
};

export default function RootLayout() {
  // The launch screen lifts as soon as the first screen has drawn.
  useHideSplashScreen();

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
        <Stack.Screen
          name="index"
          options={{ title: 'Mini Cities', headerLargeTitleEnabled: true }}
        />
        <Stack.Screen name="city/[cityId]" options={{ title: '' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        {/*
          "Choose on map": a full-height sheet with a grabber; swipe down to
          cancel. Only ever one: a second link (or a quick second tap) moves
          the open sheet's map instead of stacking another sheet.
        */}
        <Stack.Screen
          name="pick"
          dangerouslySingular
          options={{
            title: 'Choose on map',
            presentation: 'formSheet',
            sheetAllowedDetents: [1],
            sheetGrabberVisible: true,
            headerShown: false,
          }}
        />
        {/*
          A place's viewpoints (T60): a half-height sheet with a grabber that
          pulls up to full height; swipe down to close. Only ever one.
        */}
        <Stack.Screen
          name="viewpoints/[cityId]"
          dangerouslySingular
          options={{
            title: 'Viewpoints',
            presentation: 'formSheet',
            sheetAllowedDetents: [0.5, 1],
            sheetGrabberVisible: true,
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="view/[cityId]"
          options={{
            presentation: 'fullScreenModal',
            headerShown: false,
            // Every way but upside down: upright is full screen, sideways the
            // two-eye view. Leaving it, the preview turns the phone back upright.
            orientation: 'default',
            autoHideHomeIndicator: true,
            // Per screen, the way iOS 27 still honors (Info.plist turns on
            // view-controller-based status bars; the app-wide call is ignored).
            statusBarHidden: true,
          }}
        />
      </Stack>
    </AppProviders>
  );
}
