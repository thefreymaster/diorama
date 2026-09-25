import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRouter } from 'expo-router';

import type { PlacePickerRegion } from '@diorama/native';
import { useShowCity } from '@/screens/CityPicker/useOpenCity';
import { actionHaptic } from '@/ui';

import { pickedPlace } from './pickedPlace';
import { spotNameQuery } from './spotName';

/**
 * "Open diorama": names the spot (with the name the card shows, or the one
 * on its way, within a few seconds; else its coordinates), closes the sheet
 * and opens the spot's preview. It joins Recent like any place you open.
 * Taps while it names are ignored.
 */
export function useOpenSpot() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const navigation = useNavigation();
  const showCity = useShowCity();

  const mutation = useMutation({
    mutationFn: async (spot: PlacePickerRegion) => {
      const address = await queryClient.fetchQuery(spotNameQuery(spot)).catch(() => null);
      return pickedPlace(spot, address);
    },
    networkMode: 'always',
  });

  const open = (spot: PlacePickerRegion) => {
    if (mutation.isPending) return;
    actionHaptic();
    mutation.mutate(spot, {
      onSuccess: (place) => {
        // Swiped away while it named the spot: stay where you are.
        if (!navigation.isFocused()) return;
        router.back();
        showCity(place);
      },
    });
  };

  return { open, isOpening: mutation.isPending };
}
