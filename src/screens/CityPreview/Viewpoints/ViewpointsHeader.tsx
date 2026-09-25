import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';
import { GlassButton, Text } from '@/ui';

type ViewpointsHeaderProps = {
  /** The place the list is for, under the title. */
  placeName?: string;
};

/**
 * The top of the Viewpoints sheet, as on an Apple Maps sheet: a bold title
 * with the place under it, and a round glass ✕ that does what swiping the
 * sheet down does, for anyone who can't (VoiceOver).
 */
export function ViewpointsHeader({ placeName }: ViewpointsHeaderProps) {
  const router = useRouter();

  return (
    <View style={styles.header}>
      <View style={styles.titles}>
        <Text variant="title2" emphasized accessibilityRole="header">
          Viewpoints
        </Text>
        {placeName ? (
          <Text variant="subheadline" color="secondaryLabel">
            {placeName}
          </Text>
        ) : null}
      </View>
      <GlassButton symbol="xmark" accessibilityLabel="Close" onPress={() => router.back()} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.xl,
  },
  titles: { flex: 1, paddingTop: spacing.xs },
});
