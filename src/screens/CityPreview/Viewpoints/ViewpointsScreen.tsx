import { useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';

import { useCity } from '@/features/cities/queries';
import { useViewpoints } from '@/features/viewpoints/queries';
import { colors, spacing } from '@/theme';
import { InsetGroupedSection, SkeletonRow } from '@/ui';

import { useCloseWhenEmpty } from './useCloseWhenEmpty';
import { useOpenLinkedViewpoint } from './useOpenLinkedViewpoint';
import { useOpenViewpoint } from './useOpenViewpoint';
import { ViewpointRow } from './ViewpointRow';
import { ViewpointsHeader } from './ViewpointsHeader';

/** Placeholder rows while Apple Maps answers (rarely seen: the card waits for the list). */
const SKELETON_ROWS = 4;

/**
 * A place's viewpoints, in a sheet over its preview: scenic views first,
 * then visitor centers, each nearest first, with how far each is from the
 * middle of the place. Tapping one opens it as a place of its own. With
 * nothing to list, the sheet closes rather than show up empty.
 *
 * The scroll view is the sheet's root (the title scrolls with the list):
 * that's how a native sheet finds it, to pull up to full height as you
 * scroll, and it sizes itself to the sheet at either height.
 */
export function ViewpointsScreen() {
  const { cityId } = useLocalSearchParams<'/viewpoints/[cityId]'>();
  const city = useCity(cityId).data ?? null;
  const { viewpoints, isLoading } = useViewpoints(city);
  const openViewpoint = useOpenViewpoint(city);
  useCloseWhenEmpty(!isLoading && viewpoints.length === 0);
  useOpenLinkedViewpoint(viewpoints, openViewpoint);

  const footer =
    city && viewpoints.length > 0 ? `Distances from the center of ${city.name}.` : undefined;

  return (
    <ScrollView
      testID="viewpoints-screen"
      style={styles.screen}
      contentContainerStyle={styles.content}
    >
      <ViewpointsHeader placeName={city?.name} />
      <InsetGroupedSection footer={footer}>
        {isLoading
          ? Array.from({ length: SKELETON_ROWS }, (_, index) => <SkeletonRow key={index} />)
          : viewpoints.map((viewpoint) => (
              <ViewpointRow
                key={viewpoint.id}
                viewpoint={viewpoint}
                onPress={() => openViewpoint(viewpoint)}
              />
            ))}
      </InsetGroupedSection>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.systemGroupedBackground },
  content: { paddingBottom: spacing.xxxl },
});
