import { Redirect, Stack } from 'expo-router';

import { colors } from '@/theme';
import { UIGalleryScreen } from '@/ui/dev/UIGalleryScreen';

/** Dev-only gallery of the UI primitives. Open with diorama://dev/ui. */
export default function DevUIRoute() {
  if (!__DEV__) return <Redirect href="/" />;

  return (
    <>
      <Stack.Screen
        options={{
          title: 'UI kit',
          headerLargeTitleEnabled: true,
          headerLargeTitleShadowVisible: false,
          headerLargeStyle: { backgroundColor: colors.systemGroupedBackground },
        }}
      />
      <UIGalleryScreen />
    </>
  );
}
