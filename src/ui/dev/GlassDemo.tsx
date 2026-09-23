import { StyleSheet, View } from 'react-native';

import { colors, metrics, spacing, type ColorToken } from '@/theme';

import { GlassButton } from '../GlassButton';
import { GlassSurface } from '../GlassSurface';
import { Text } from '../Text';
import { noop } from './sampleData';

/** Heights (as % of the backdrop) and colors of the toy skyline behind the glass. */
const skyline: { height: `${number}%`; color: ColorToken }[] = [
  { height: '45%', color: 'systemIndigo' },
  { height: '70%', color: 'systemOrange' },
  { height: '55%', color: 'systemPink' },
  { height: '85%', color: 'systemYellow' },
  { height: '40%', color: 'systemGreen' },
  { height: '65%', color: 'systemPurple' },
];

/** Gallery-only: glass controls over colorful content, where materials show. */
export function GlassDemo() {
  return (
    <View style={styles.backdrop}>
      <View style={styles.skyline}>
        {skyline.map((block, index) => (
          <View
            key={index}
            style={[styles.block, { height: block.height, backgroundColor: colors[block.color] }]}
          />
        ))}
      </View>
      <View style={styles.topBar}>
        <GlassButton symbol="xmark" accessibilityLabel="Close" onPress={noop} />
        <GlassButton symbol="gearshape.fill" accessibilityLabel="Settings" onPress={noop} />
      </View>
      <View style={styles.bottomBar}>
        <GlassSurface style={styles.card}>
          <Text variant="headline">Venice</Text>
          <Text variant="subheadline" color="secondaryLabel">
            Italy
          </Text>
        </GlassSurface>
        <GlassButton title="Recenter" symbol="scope" onPress={noop} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    height: 240,
    borderRadius: metrics.sectionRadius,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: colors.systemCyan,
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  skyline: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  block: { flex: 1, borderTopLeftRadius: spacing.xs, borderTopRightRadius: spacing.xs },
  topBar: { flexDirection: 'row', justifyContent: 'space-between' },
  bottomBar: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  card: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: spacing.xl,
  },
});
