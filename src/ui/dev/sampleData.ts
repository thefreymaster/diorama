import type { SFSymbol } from 'expo-symbols';

import type { ColorToken } from '@/theme';

type SampleCity = {
  id: string;
  name: string;
  country: string;
  symbol: SFSymbol;
  tile: ColorToken;
};

/** Stand-in rows for the UI gallery. The real list arrives with T06. */
export const sampleFeatured: SampleCity[] = [
  {
    id: 'new-york',
    name: 'New York',
    country: 'United States',
    symbol: 'building.2.fill',
    tile: 'systemBlue',
  },
  {
    id: 'paris',
    name: 'Paris',
    country: 'France',
    symbol: 'building.columns.fill',
    tile: 'systemIndigo',
  },
  {
    id: 'sydney',
    name: 'Sydney',
    country: 'Australia',
    symbol: 'sailboat.fill',
    tile: 'systemTeal',
  },
  { id: 'tokyo', name: 'Tokyo', country: 'Japan', symbol: 'tram.fill', tile: 'systemRed' },
];

export const sampleRecents = [
  { id: 'rome', name: 'Rome', region: 'Lazio, Italy' },
  { id: 'mount-everest', name: 'Mount Everest', region: 'Sagarmatha National Park, Nepal' },
];

/** Does nothing: gallery rows and buttons only need to look tappable. */
export function noop(): void {}
