import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme';

import { CityNotFound } from './CityNotFound';
import { PreviewCard } from './PreviewCard';
import { PreviewHeader } from './PreviewHeader';
import { PreviewMap } from './PreviewMap';
import { usePreviewCity } from './usePreviewCity';
import { usePreviewMapStatus } from './usePreviewMapStatus';

/**
 * A city before you put the phone in the viewer: its 3D map slowly turning,
 * full-bleed, under a glass card with its name and "Enter Diorama".
 */
export function CityPreviewScreen() {
  const city = usePreviewCity();
  const map = usePreviewMapStatus();

  if (!city) return <CityNotFound />;

  return (
    <View testID="city-preview-screen" style={styles.screen}>
      <PreviewHeader title={city.name} />
      <PreviewMap city={city} isReady={map.isReady} onReady={map.onReady} />
      <PreviewCard city={city} showTerrainNote={map.showTerrainNote} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.systemGroupedBackground },
});
