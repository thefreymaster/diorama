import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { metrics, spacing } from '@/theme';
import { Screen, SymbolIcon, Text } from '@/ui';

const TITLE = 'City not found';
const BODY = 'Search for it again, or choose a featured city.';

/**
 * For a link to a city the app doesn't know (or no longer remembers): a
 * quiet note in the style of SwiftUI's `ContentUnavailableView`, with a
 * plain button back to the city list.
 */
export function CityNotFound() {
  const router = useRouter();
  const backToCities = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <Screen background="grouped" scroll={false}>
      <View testID="city-not-found" style={styles.container}>
        <View style={styles.message} accessible accessibilityLabel={`${TITLE}. ${BODY}`}>
          <SymbolIcon name="mappin.slash" size={44} color="secondaryLabel" style={styles.symbol} />
          <Text variant="title3" emphasized style={styles.center}>
            {TITLE}
          </Text>
          <Text variant="subheadline" color="secondaryLabel" style={styles.center}>
            {BODY}
          </Text>
        </View>
        <Pressable
          onPress={backToCities}
          accessibilityRole="button"
          hitSlop={spacing.md}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Text color="tint">Choose a city</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    marginHorizontal: metrics.screenMargin + spacing.lg,
    // Sit a little above the middle, where the eye expects it.
    paddingBottom: spacing.huge,
  },
  message: { alignItems: 'center', gap: spacing.xs },
  symbol: { marginBottom: spacing.sm },
  center: { textAlign: 'center' },
  // A plain (borderless) UIKit button dims while it's held.
  pressed: { opacity: 0.3 },
});
