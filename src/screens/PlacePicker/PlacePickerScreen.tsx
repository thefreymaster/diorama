import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { colors } from '@/theme';

import { PickerCloseButton } from './PickerCloseButton';
import { PickerMap } from './PickerMap';
import { SpotCard } from './SpotCard';
import { usePickedSpot } from './usePickedSpot';
import { usePickerStart } from './usePickerStart';

/**
 * "Choose on map", in a sheet: move the map under a fixed pin, as in Apple
 * Maps' "Move pin to location", and the card names the spot under it. "Open
 * diorama" opens that spot's preview, and it joins Recent.
 */
export function PlacePickerScreen() {
  const start = usePickerStart();
  const { spot, onRegionChangeEnd } = usePickedSpot(start);
  const [coverHeight, setCoverHeight] = useState(0);

  return (
    <View testID="place-picker-screen" style={styles.screen}>
      {start && spot ? (
        <>
          <PickerMap
            start={start}
            attributionInset={coverHeight}
            onRegionChangeEnd={onRegionChangeEnd}
          />
          <SpotCard spot={spot} onCoverHeight={setCoverHeight} />
        </>
      ) : (
        <ActivityIndicator style={styles.fill} />
      )}
      <PickerCloseButton />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.systemGroupedBackground },
  fill: { flex: 1 },
});
