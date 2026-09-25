import type { SFSymbol } from 'expo-symbols';

import type { PointOfInterestCategory } from '@diorama/native';
import type { ColorToken } from '@/theme';

/** How a kind of viewpoint shows in a list. */
export type ViewpointKind = {
  /** Sentence case, e.g. "Scenic view". */
  label: string;
  /** Row glyph. Must exist in SF Symbols 4.2 or earlier (iOS 16.4). */
  symbol: SFSymbol;
  /** Row tile color, for `<RowIcon tileColor>`. */
  tileColor: ColorToken;
};

/** Label, glyph and tile color for each kind Apple Maps can list. */
export const VIEWPOINT_KINDS: Readonly<Record<PointOfInterestCategory, ViewpointKind>> = {
  scenicView: { label: 'Scenic view', symbol: 'binoculars.fill', tileColor: 'systemGreen' },
  visitorCenter: { label: 'Visitor center', symbol: 'info', tileColor: 'systemBlue' },
  rangerStation: { label: 'Ranger station', symbol: 'flag.fill', tileColor: 'systemBrown' },
  picnicArea: { label: 'Picnic area', symbol: 'fork.knife', tileColor: 'systemOrange' },
  restArea: { label: 'Rest area', symbol: 'car.fill', tileColor: 'systemIndigo' },
};
