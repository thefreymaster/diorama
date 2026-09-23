import Slider from '@react-native-community/slider';
import { StyleSheet, View } from 'react-native';

import { metrics, spacing, useScaledSize, type ColorToken } from '@/theme';
import { SymbolIcon } from '@/ui';
import { RowSeparator } from '@/ui/RowSeparator';
import { rowStyles } from '@/ui/rowStyles';

import { SLIDER_SETTINGS, type SliderSetting } from './sliderSettings';
import { useSettingSlider } from './useSettingSlider';

/** Width of the slot each end glyph is centered in, so every slider lines up. */
const END_SLOT = 28;

/**
 * A list row that is just a slider (a native UISlider) between two glyphs,
 * like Brightness in Settings. The section header names it.
 */
export function SettingSlider({ setting }: { setting: SliderSetting }) {
  const { title, minSymbol, maxSymbol } = SLIDER_SETTINGS[setting];
  const slider = useSettingSlider(setting);
  const slot = { width: useScaledSize(END_SLOT) };
  const glyphColor: ColorToken = slider.disabled ? 'tertiaryLabel' : 'secondaryLabel';

  return (
    <View style={[rowStyles.row, rowStyles.textOnly]}>
      <View style={[rowStyles.content, styles.content]}>
        <RowSeparator />
        <View style={[styles.end, slot]}>
          <SymbolIcon name={minSymbol.name} size={minSymbol.size} color={glyphColor} />
        </View>
        <Slider
          testID={`${setting}-slider`}
          style={styles.slider}
          minimumValue={0}
          maximumValue={1}
          value={slider.position}
          disabled={slider.disabled}
          onValueChange={slider.onChange}
          onSlidingComplete={slider.onChange}
          accessibilityLabel={title}
        />
        <View style={[styles.end, slot]}>
          <SymbolIcon name={maxSymbol.name} size={maxSymbol.size} color={glyphColor} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // A little taller than a text row, like the Brightness row.
  content: { minHeight: metrics.rowMinHeight + spacing.xs },
  end: { alignItems: 'center' },
  slider: { flex: 1 },
});
