import { Redirect, Stack } from 'expo-router';

import { UIGalleryScreen } from '@/ui/dev/UIGalleryScreen';

/** Dev-only gallery of the UI primitives. Open with diorama://dev/ui. */
export default function DevUIRoute() {
  if (!__DEV__) return <Redirect href="/" />;

  // Only the title and large-title switch: the header's look comes from the
  // root Stack, and overriding the large-title style there hides the title.
  return (
    <>
      <Stack.Screen options={{ title: 'UI kit', headerLargeTitleEnabled: true }} />
      <UIGalleryScreen />
    </>
  );
}
