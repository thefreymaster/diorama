import { Stack } from 'expo-router';
import { View } from 'react-native';

import { metrics } from '@/theme';

type PreviewHeaderProps = {
  /** The city name. */
  title: string;
};

/**
 * The preview's navigation bar: see-through, so the map runs full-bleed
 * under a floating back button, like Apple Maps. The city name is the
 * screen's real title (a screen pushed on top says "‹ Paris", and it names
 * the page in the back-button menu), but it isn't drawn over the map: the
 * card already shows it, and text on photos is hard to read. Before iOS 26,
 * bar buttons have no glass of their own, so the bar gets a blur there.
 */
export function PreviewHeader({ title }: PreviewHeaderProps) {
  return (
    <Stack.Screen
      options={{
        title,
        // An empty title view. Returning null instead leaves UIKit with no
        // title view, and it falls back to drawing `title` over the map.
        headerTitle: () => <View />,
        headerTransparent: true,
        headerBlurEffect: metrics.isModernIOS ? undefined : 'systemChromeMaterial',
      }}
    />
  );
}
