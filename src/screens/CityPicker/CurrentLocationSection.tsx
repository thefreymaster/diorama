import { useNavigation } from 'expo-router';

import { LOCATE_SUBTITLES, useLocateMe } from '@/features/location/useLocateMe';
import { useShowHere } from '@/features/location/useShowHere';
import { InsetGroupedSection, ListRow } from '@/ui';
import { tapClosesOpenSwipeRow } from '@/ui/openSwipeRow';

/**
 * "Current location" at the top of the picker, as in Apple Maps: a tap finds
 * where you are and opens the diorama there, following you live as you move
 * (T40), and the spot joins Recent. The line under it says when it's
 * looking, when location access is off (a tap then opens Settings) and when
 * nothing was found (a tap tries again).
 */
export function CurrentLocationSection() {
  const { status, locate } = useLocateMe();
  const showHere = useShowHere();
  const navigation = useNavigation();

  return (
    <InsetGroupedSection>
      <ListRow
        title="Current location"
        subtitle={LOCATE_SUBTITLES[status]}
        symbol="location.fill"
        accessibilityHint={status === 'denied' ? 'Opens Settings.' : undefined}
        onPress={() => {
          // A tap that closes a swiped-open row below does only that, as in iOS.
          if (tapClosesOpenSwipeRow()) return;
          locate((place) => {
            // They may have moved on (say, to Settings) while it looked.
            if (navigation.isFocused()) showHere(place);
          });
        }}
      />
    </InsetGroupedSection>
  );
}
