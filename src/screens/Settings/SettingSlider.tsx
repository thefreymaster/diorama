import Slider from '@react-native-community/slider';
import { StyleSheet, View } from 'react-native';

import { metrics, spacing, useScaledSize, type ColorToken } from '@/theme';
import { ControlRow, SymbolIcon } from '@/ui';

import { SLIDER_SETTINGS, type GlyphSliderSetting } from './sliderSettings';
import { useSettingSlider } from './useSettingSlider';

/** Width of the slot each end glyph is centered in, so every slider lines up. */
const END_SLOT = 28;
/** A little taller than a text row, like the Brightness row. */
const ROW_HEIGHT = metrics.rowMinHeight + spacing.xs;

/**
 * A list row that is just a slider (a native UISlider) between two glyphs,
 * like Brightness in Settings. The section header names it.
 */
export function SettingSlider({ setting }: { setting: GlyphSliderSetting }) {
  const { title, minSymbol, maxSymbol } = SLIDER_SETTINGS[setting];
  const slider = useSettingSlider(setting);
  const slot = { width: useScaledSize(END_SLOT) };
  const glyphColor: ColorToken = slider.disabled ? 'tertiaryLabel' : 'secondaryLabel';

  return (
    <ControlRow minHeight={ROW_HEIGHT}>
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
    </ControlRow>
  );
}

const styles = StyleSheet.create({
  end: { alignItems: 'center' },
  slider: { flex: 1 },
});
