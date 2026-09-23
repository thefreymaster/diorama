import Slider from '@react-native-community/slider';
import { StyleSheet, View } from 'react-native';

import { spacing, type ColorToken } from '@/theme';
import { ControlRow, Text } from '@/ui';

import { FIT_SETTINGS, type FitSetting } from './sliderSettings';
import { ADJUST_ACTIONS, useFitSlider } from './useFitSlider';

/**
 * One "Viewer fit" row: the size's name with its value in millimeters on
 * the right, and a native slider (UISlider) under them. VoiceOver reads the
 * whole row as one adjustable control ("Lens spacing, 64 millimeters").
 */
export function FitSliderRow({ setting }: { setting: FitSetting }) {
  const { title } = FIT_SETTINGS[setting];
  const slider = useFitSlider(setting);
  const titleColor: ColorToken = slider.disabled ? 'tertiaryLabel' : 'label';
  const valueColor: ColorToken = slider.disabled ? 'tertiaryLabel' : 'secondaryLabel';

  return (
    <ControlRow>
      <View
        style={styles.stack}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={title}
        accessibilityValue={{ text: slider.spokenValue }}
        accessibilityState={{ disabled: slider.disabled }}
        accessibilityActions={ADJUST_ACTIONS}
        onAccessibilityAction={slider.onAccessibilityAction}
      >
        <View style={styles.line}>
          <Text color={titleColor} style={styles.title}>
            {title}
          </Text>
          <Text testID={`${setting}-value`} color={valueColor} style={styles.value}>
            {slider.valueText}
          </Text>
        </View>
        <Slider
          testID={`${setting}-slider`}
          minimumValue={0}
          maximumValue={1}
          step={slider.positionStep}
          value={slider.position}
          disabled={slider.disabled}
          onValueChange={slider.onChange}
          onSlidingComplete={slider.onChange}
        />
      </View>
    </ControlRow>
  );
}

const styles = StyleSheet.create({
  stack: { flex: 1, gap: spacing.xs, paddingTop: spacing.xs },
  line: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  title: { flex: 1 },
  // Every digit the same width, so the number holds still as it changes.
  value: { fontVariant: ['tabular-nums'] },
});
